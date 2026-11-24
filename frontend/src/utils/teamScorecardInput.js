import * as XLSX from 'xlsx/xlsx.mjs'
import { MAX_SCORECARD_FILE_BYTES } from './rankingScorecardInput.js'

const MAX_ROWS = 5000
const MAX_COLUMNS = 64
const MAX_SHEETS = 16
const MAX_EXPANDED = 64 * 1024 * 1024
const DISTANCES = new Set([10, 18, 30, 50, 70])
const SERIAL_HEADERS = new Set(['序号', '队伍序号', '编号'])
const TEAM_HEADERS = new Set(['团体参赛队', '混双参赛队', '参赛队', '队名', '队伍'])
const PLAYER_HEADERS = new Set(['参赛选手', '参赛人员', '运动员', '姓名', '队员'])
const BOWS = [
  ['recurve', ['反曲弓']], ['traditional', ['传统弓']], ['longbow', ['美猎弓']],
  ['barebow', ['光弓']], ['compound', ['复合弓']], ['sightless', ['无瞄弓', '无瞄']],
]
const compact = value => value.replace(/\s+/g, '')
const atError = (sheet, row, column, message) => new Error('工作表“' + sheet + '”第' + (row + 1) + '行（' + XLSX.utils.encode_col(column) + '列）：' + message)
const hasValue = cell => cell && (cell.f != null || cell.t === 'e' || cell.t === 'b' || (cell.v != null && String(cell.v).trim() !== ''))
const text = (cell, sheet, row, column) => {
  if (!hasValue(cell)) return ''
  if (cell.f != null) throw atError(sheet, row, column, '含公式，请先转换为文本或数值')
  if (!['s', 'str', 'n'].includes(cell.t) || (cell.t === 'n' && !Number.isFinite(cell.v))) throw atError(sheet, row, column, '含错误值或不是有效文本')
  const value = String(cell.t === 'n' ? cell.w ?? cell.v : cell.v).trim()
  if (Array.from(value).length > 120) throw atError(sheet, row, column, '文字最多允许120个字符')
  return value
}
const groupMetadata = (label, sheet, row, column) => {
  const value = compact(label)
  const mixed = /混双|混合团体/.test(value)
  const format = mixed ? 'mixed_team' : 'team'
  const bows = BOWS.filter(([, names]) => names.some(name => value.includes(name)))
  const distance = value.match(/(?:^|[^0-9])([0-9]+)(?:米|m)(?![a-z])/i)
  const men = /男子|男组/.test(value), women = /女子|女组/.test(value)
  if (bows.length !== 1 || !distance || !DISTANCES.has(Number(distance[1])) || (men && women) || (/混双/.test(value) && /团体/.test(value)) || (!mixed && !value.includes('团体'))) throw atError(sheet, row, column, '无法识别队伍分组；请明确弓种、10/18/30/50/70米距离及团体/混双格式')
  return { format, bowType: bows[0][0], distance: Number(distance[1]) + 'm', genderGroup: women ? 'women' : men ? 'men' : 'mixed', label }
}

const checkAddress = (address, name) => {
  if (!/^[A-Z]+[1-9]\d*$/i.test(address)) throw new Error('工作表“' + name + '”范围无效')
  const decoded = XLSX.utils.decode_cell(address.toUpperCase())
  if (decoded.r >= MAX_ROWS || decoded.c >= MAX_COLUMNS) throw new Error('工作表“' + name + '”使用范围过大，最多5000行、64列')
  return decoded
}
const checkRange = (range, name) => {
  if (!range) return
  const parts = range.split(':')
  if (parts.length > 2) throw new Error('工作表“' + name + '”范围无效')
  parts.forEach(value => checkAddress(value.replace(/\$/g, ''), name))
}
const preflight = bytes => {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break }
  }
  if (end < 0) throw new Error('Excel 压缩包不完整')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  if (count > 1000 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || offset + view.getUint32(end + 12, true) !== end) throw new Error('Excel 压缩包目录异常或项目过多')
  let expanded = 0
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Excel 压缩包目录损坏')
    expanded += view.getUint32(offset + 24, true)
    if (expanded > MAX_EXPANDED) throw new Error('Excel 解压后内容超过64MiB，请清除多余内容或格式')
    if (view.getUint16(offset + 8, true) & 1) throw new Error('请先取消 Excel 密码保护')
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  if (offset !== end) throw new Error('Excel 压缩包目录损坏')
  const archive = XLSX.CFB.read(bytes, { type: 'array' })
  let sheets = 0
  let cells = 0
  archive.FullPaths.forEach((path, index) => {
    if (!/\/xl\/worksheets\/[^/]+\.xml$/.test(path)) return
    if (++sheets > MAX_SHEETS) throw new Error('Excel 最多允许16张工作表')
    const content = new Uint8Array(archive.FileIndex[index].content)
    const encoding = content[0] === 0xff && content[1] === 0xfe ? 'utf-16le' : content[0] === 0xfe && content[1] === 0xff ? 'utf-16be' : 'utf-8'
    const xml = new TextDecoder(encoding).decode(content)
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Excel 不支持自定义 XML 实体')
    for (const match of xml.matchAll(/<(?:\w+:)?dimension\b[^>]*\bref=["']([^"']+)["']/g)) checkRange(match[1], path.split('/').pop())
    for (const match of xml.matchAll(/<(?:\w+:)?(?:row|c)\b[^>]*\br=["']([^"']+)["']/g)) {
      if (/^[1-9]\d*$/.test(match[1])) {
        if (Number(match[1]) > MAX_ROWS) throw new Error('Excel 使用范围超过5000行')
      } else {
        checkAddress(match[1], path.split('/').pop())
        if (++cells > 200000) throw new Error('Excel 单元格过多，请清除多余内容或格式')
      }
    }
  })
}

// Synchronous SHA-256 keeps fingerprints deterministic without exposing names
// or requiring async WebCrypto / a new dependency in this pure parser.
const SHA_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
const sha256 = value => {
  const input = new TextEncoder().encode(value)
  const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64)
  bytes.set(input); bytes[input.length] = 0x80
  const view = new DataView(bytes.buffer)
  view.setUint32(bytes.length - 8, Math.floor(input.length * 8 / 4294967296))
  view.setUint32(bytes.length - 4, input.length * 8 >>> 0)
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const words = new Uint32Array(64)
  const rotate = (x, n) => (x >>> n) | (x << (32 - n))
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const x = words[i - 15], y = words[i - 2]
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let i = 0; i < 64; i += 1) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + SHA_CONSTANTS[i] + words[i]) >>> 0
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0
    }
    for (const [i, word] of [a, b, c, d, e, f, g, h].entries()) hash[i] = (hash[i] + word) >>> 0
  }
  return hash.map(word => word.toString(16).padStart(8, '0')).join('')
}


const parseTeamSheet = (sheet, name, groups) => {
  if (!sheet) throw new Error('工作表“' + name + '”无法读取')
  checkRange(sheet['!fullref'] || sheet['!ref'], name)
  const merges = sheet['!merges'] || []
  merges.forEach(merge => checkRange(XLSX.utils.encode_range(merge), name))
  const populated = []
  let lastRow = merges.reduce((maximum, merge) => Math.max(maximum, merge.e.r), sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).e.r : 0)
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!')) continue
    const { r, c } = checkAddress(address, name)
    if (!hasValue(cell)) continue
    populated.push({ r, c, cell })
    lastRow = Math.max(lastRow, r)
  }
  populated.sort((a, b) => a.r - b.r || a.c - b.c)
  const get = (row, column) => sheet[XLSX.utils.encode_cell({ r: row, c: column })]
  const plain = cell => ['s', 'str'].includes(cell?.t) ? compact(String(cell.v ?? '').trim()) : ''
  const headerRows = populated.filter(({ cell }) => SERIAL_HEADERS.has(plain(cell)))
  const serialColumns = new Set(headerRows.map(item => item.c))
  const titles = populated.filter(({ c, cell }) => {
    const value = plain(cell)
    const rosterColumn = [...serialColumns].some(column => c === column + 1 || c === column + 2) && !serialColumns.has(c)
    return !rosterColumn && /团体|混双/.test(value) && /弓|无瞄|[0-9]+(?:米|m)/i.test(value) && !TEAM_HEADERS.has(value)
  }).map(({ r, c, cell }) => ({ r, c, metadata: groupMetadata(text(cell, name, r, c), name, r, c) }))
  for (const { r, c } of headerRows) {
    const team = plain(get(r, c + 1))
    const player = plain(get(r, c + 2))
    const title = titles.filter(title => title.c === c && title.r < r).at(-1)
    if (!title && !TEAM_HEADERS.has(team)) continue
    if (!title) throw atError(name, r, c, '队伍表头前缺少可识别的团体/混双分组标题')
    if (!TEAM_HEADERS.has(team) || !PLAYER_HEADERS.has(player)) throw atError(name, r, c, '队伍表头应为“序号、团体参赛队、参赛选手”三列')
  }
  for (const title of titles) {
    const { c, metadata } = title
    const end = titles.find(next => next.c === c && next.r > title.r)?.r ?? lastRow + 1
    const firstContent = populated.find(item => item.r > title.r && item.r < end && item.c >= c && item.c <= c + 2)
    if (!firstContent) throw atError(name, title.r, c, '队伍分组缺少表头')
    const header = firstContent.r
    if (!SERIAL_HEADERS.has(plain(get(header, c))) || !TEAM_HEADERS.has(plain(get(header, c + 1))) || !PLAYER_HEADERS.has(plain(get(header, c + 2)))) throw atError(name, header, c, '队伍分组下缺少“序号、团体参赛队、参赛选手”表头')
    const size = metadata.format === 'team' ? 3 : 2
    const key = JSON.stringify([metadata.format, metadata.bowType, metadata.distance, metadata.genderGroup])
    const identities = []
    const mergeAt = (row, column) => merges.find(merge => merge.s.r <= row && merge.e.r >= row && merge.s.c <= column && merge.e.c >= column)
    const teamText = row => {
      const merge = mergeAt(row, c + 1)
      if (merge && (merge.s.c !== c + 1 || merge.e.c !== c + 1 || merge.s.r <= header || merge.e.r >= end)) throw atError(name, row, c + 1, '队名合并跨越列、表头或分组边界')
      return text(get(merge?.s.r ?? row, c + 1), name, row, c + 1)
    }
    for (let row = header + 1; row < end; row += 1) {
      const serialCell = get(row, c)
      if (!hasValue(serialCell)) continue // Unnumbered leftover names/formatting are not entries.
      if (SERIAL_HEADERS.has(plain(serialCell))) continue
      if (serialCell.f != null || serialCell.t === 'e' || serialCell.t === 'b') text(serialCell, name, row, c)
      const raw = text(serialCell, name, row, c)
      const serial = serialCell.t === 'n' ? serialCell.v : /^[0-9]+$/.test(raw) ? Number(raw) : NaN
      let stop = Math.min(row + size, end)
      for (let r = row + 1; r < stop; r += 1) {
        const next = get(r, c)
        if (!hasValue(next)) continue
        const value = text(next, name, r, c)
        const number = next.t === 'n' ? next.v : /^[0-9]+$/.test(value) ? Number(value) : NaN
        if (number !== serial) { stop = r; break }
      }
      const players = []
      const teamNames = []
      for (let r = row; r < stop; r += 1) {
        const merge = mergeAt(r, c + 2)
        if (merge && (merge.s.r !== merge.e.r || merge.s.c !== merge.e.c)) throw atError(name, r, c + 2, '选手姓名不能合并；请每名选手占一行')
        players.push(text(get(r, c + 2), name, r, c + 2))
        teamNames.push(teamText(r))
      }
      if (players.every(player => !player)) { row = stop - 1; continue } // Numbered empty template placeholder.
      if (!Number.isSafeInteger(serial) || serial <= 0) throw atError(name, row, c, '有效参赛队序号必须为正整数，序号不作为比赛排位')
      const serialMerge = mergeAt(row, c)
      if (serialMerge && (serialMerge.s.c !== c || serialMerge.e.c !== c || serialMerge.s.r !== row || serialMerge.e.r !== row + size - 1)) throw atError(name, row, c, '序号合并范围应恰好覆盖该队' + size + '名选手')
      for (let r = row + 1; r < stop; r += 1) {
        const value = get(r, c)
        if (!hasValue(value)) continue
        const printed = text(value, name, r, c)
        if ((value.t === 'n' ? value.v : /^[0-9]+$/.test(printed) ? Number(printed) : NaN) !== serial) throw atError(name, r, c, '上一支队伍尚未填足' + size + '人，不能提前填写新队序号')
      }
      if (players.length !== size || players.some(player => !player)) throw atError(name, row, c + 2, '有序号的' + (size === 3 ? '团体' : '混双') + '队伍必须填足' + size + '名选手')
      const fallback = teamNames.find(Boolean)
      if (!fallback) throw atError(name, row, c + 1, '有效参赛队缺少队名或俱乐部')
      // Each row may have a different club. Do not split a cross-club team or
      // deduplicate two separately numbered teams that share a club/name.
      identities.push(JSON.stringify(players.map((player, index) => JSON.stringify([teamNames[index] || fallback, player])).sort()))
      row += size - 1
    }
    if (identities.length) {
      if (!groups.has(key)) groups.set(key, { ...metadata, teams: [] })
      groups.get(key).teams.push(...identities)
    }
  }
}

/** Return only group metadata/fingerprints; never expose roster or ordinal data. */
export function parseTeamScorecardGroups(input) {
  let bytes
  if (Object.prototype.toString.call(input) === '[object ArrayBuffer]') bytes = new Uint8Array(input)
  else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  else throw new Error('请选择有效的Excel队伍工作簿')
  if (!bytes.length) throw new Error('Excel队伍工作簿为空')
  if (bytes.length > MAX_SCORECARD_FILE_BYTES) throw new Error('Excel队伍工作簿不能超过10MiB')
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const legacy = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte)
  if (!zip && !legacy) throw new Error('请选择真正的.xlsx或.xls文件，不支持CSV或文本')
  let book
  try { preflight(bytes); book = XLSX.read(bytes, { type: 'array', sheetRows: MAX_ROWS + 1, cellFormula: true, cellText: true }) }
  catch (error) { throw new Error('无法读取队伍工作簿：' + (error?.message || '文件损坏')) }
  if (book.SheetNames.length > MAX_SHEETS) throw new Error('Excel最多允许16张工作表')
  const groups = new Map()
  for (const name of book.SheetNames) parseTeamSheet(book.Sheets[name], name, groups)
  return [...groups.values()].map(({ teams, ...group }) => ({ ...group, participantCount: teams.length, fingerprint: 'sha256:' + sha256(JSON.stringify(teams.sort())) }))
}
