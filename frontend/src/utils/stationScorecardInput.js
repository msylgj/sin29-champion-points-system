import * as XLSX from 'xlsx/xlsx.mjs'
import { MAX_SCORECARD_FILE_BYTES } from './rankingScorecardInput.js'

const MAX_ROWS = 5000
const MAX_COLUMNS = 64
const MAX_PAGES = 300
const MAX_SHEETS = 16
const MAX_TEXT = 120
const DISTANCES = new Set([10, 18, 30, 50, 70])
const MAX_EXPANDED = 64 * 1024 * 1024
const BOWS = new Map([
  ['反曲弓', 'recurve'], ['传统弓', 'traditional'], ['美猎弓', 'longbow'],
  ['光弓', 'barebow'], ['复合弓', 'compound'], ['无瞄弓', 'sightless'],
])
const errorAt = (sheet, row, message) => new Error('工作表“' + sheet + '”第' + (row + 1) + '行：' + message)
const hasValue = cell => cell && (cell.f != null || cell.t === 'e' || cell.t === 'b' || (cell.v != null && String(cell.v).trim() !== ''))
const readText = (cell, sheet, row, field) => {
  if (!hasValue(cell)) return ''
  if (cell.f != null) throw errorAt(sheet, row, field + '含公式，请先转换为文本或数值')
  if (!['s', 'str', 'n'].includes(cell.t) || (cell.t === 'n' && !Number.isFinite(cell.v))) throw errorAt(sheet, row, field + '含错误值或不是有效文本')
  const value = String(cell.t === 'n' ? cell.w ?? cell.v : cell.v).trim()
  if (Array.from(value).length > MAX_TEXT) throw errorAt(sheet, row, field + '最多允许120个字符')
  return value
}
const compact = value => value.replace(/\s+/g, '')
const headerKind = value => {
  const label = compact(value).replace(/^[ABCD]/i, '')
  if (['靶位号', '靶位', '靶号', '位'].includes(label)) return 'target'
  if (label === '俱乐部') return 'club'
  if (['姓名', '运动员'].includes(label)) return 'athlete'
  if (label === '轮次') return 'round'
  return ''
}
const roundInTitle = value => value.match(/第\s*([一二三四五六七八九十\d]+)\s*轮/)
const isNote = value => /冠军联赛|赛季|站位表|比赛日|运动协会|弓箭协会|^\d{4}[.年/-]\d{1,2}|^(?:⚠️?\s*)?(?:填写[需须]知|填写说明|填表说明|说明[:：]|备注[:：])/.test(value)

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

const groupMetadata = (raw, sheet, row) => {
  const explicitRound = roundInTitle(raw)
  const label = raw.replace(/[（(]?\s*第\s*[一二三四五六七八九十\d]+\s*轮\s*[）)]?/g, '').trim()
  const value = compact(label)
  const bows = [...BOWS].filter(([name]) => value.includes(name))
  const distance = value.match(/(?:^|[^0-9])([0-9]+)(?:米|m)(?![a-z])/i)
  const women = /女子|女组/.test(value), men = /男子|男组/.test(value)
  if (bows.length !== 1 || !distance || !DISTANCES.has(Number(distance[1])) || (women && men)) throw errorAt(sheet, row, '无法确定分组的弓种、距离或男女组；距离须为10/18/30/50/70米（无男女标签按混合组）')
  return { bowType: bows[0][1], distance: Number(distance[1]) + 'm', genderGroup: women ? 'women' : men ? 'men' : 'mixed', label, round: explicitRound?.[1] || null }
}

const parseHeader = (cells, sheet, row) => {
  const kinds = new Map([...cells].map(([col, cell]) => [col, headerKind(readText(cell, sheet, row, '表头'))]))
  const targets = [...kinds].filter(([, kind]) => kind === 'target').map(([col]) => col).sort((a, b) => a - b)
  if (targets.length !== 4 || targets.some(col => kinds.get(col + 1) !== 'club' || kinds.get(col + 2) !== 'athlete')) throw errorAt(sheet, row, '表头必须有四组“靶位号、俱乐部、姓名”三列')
  const roundColumns = [...kinds].filter(([, kind]) => kind === 'round').map(([col]) => col)
  const allowed = new Set([...targets.flatMap(col => [col, col + 1, col + 2]), ...roundColumns])
  if (roundColumns.length > 1 || [...cells.keys()].some(col => !allowed.has(col))) throw errorAt(sheet, row, '表头含重复轮次或无法识别的额外列')
  return { targets, roundColumn: roundColumns[0], allowed }
}

/** Parse both days/segments in physical workbook order, without persisting input. */
export function parseStationScorecards(input) {
  let bytes
  if (Object.prototype.toString.call(input) === '[object ArrayBuffer]') bytes = new Uint8Array(input)
  else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  else throw new Error('请选择有效的 Excel 站位表')
  if (!bytes.length) throw new Error('Excel 站位表为空')
  if (bytes.length > MAX_SCORECARD_FILE_BYTES) throw new Error('Excel 站位表不能超过10MiB')
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const legacy = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte)
  if (!zip && !legacy) throw new Error('请选择真正的.xlsx或.xls Excel站位表，不支持CSV或文本文件')
  let workbook
  try { preflight(bytes); workbook = XLSX.read(bytes, { type: 'array', sheetRows: MAX_ROWS + 1, cellFormula: true, cellText: true }) }
  catch (error) { throw new Error('无法读取站位表：' + (error?.message || '文件损坏')) }
  if (workbook.SheetNames.length > MAX_SHEETS) throw new Error('Excel 最多允许16张工作表')
  const pages = []
  const groups = new Map()
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) throw new Error('工作表“' + name + '”无法读取')
    checkRange(sheet['!fullref'] || sheet['!ref'], name)
    const merges = sheet['!merges'] || []
    merges.forEach(merge => checkRange(XLSX.utils.encode_range(merge), name))
    const rows = new Map()
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue
      const { r, c } = checkAddress(address, name)
      if (!hasValue(cell)) continue
      if (!rows.has(r)) rows.set(r, new Map())
      rows.get(r).set(c, cell)
    }
    let section = null
    const flush = () => {
      if (!section) return
      const hasExplicit = section.records.some(record => record.round != null)
      if (hasExplicit && section.records.some(record => record.round == null)) throw errorAt(name, section.records.find(record => record.round == null).row, '该段部分行缺少轮次，不能猜测或继承')
      const batches = hasExplicit ? [null] : ['一', '二']
      for (const round of batches) for (const record of section.records) {
        if (pages.length >= MAX_PAGES) throw errorAt(name, record.row, '排位记分纸最多300页，请拆分站位表')
        pages.push({ group: section.metadata.label, round: record.round ?? round, positions: record.positions.map(position => ({ ...position })) })
      }
      section = null
    }
    for (const [row, cells] of [...rows].sort(([a], [b]) => a - b)) {
      const only = cells.size === 1 ? [...cells.values()][0] : null
      const raw = only && only.f == null && ['s', 'str'].includes(only.t) ? String(only.v).trim() : ''
      const instruction = /^(?:⚠️?\s*)?(?:填写[需须]知|填写说明|填表说明|说明[:：]|备注[:：])/.test(raw)
      const looksGroup = raw && !instruction && /(?:[0-9]+\s*(?:米|m)|弓.*组|组.*弓)/i.test(raw)
      if (looksGroup) {
        flush()
        const label = readText(only, name, row, '组别')
        const metadata = groupMetadata(label, name, row)
        const key = JSON.stringify([metadata.bowType, metadata.distance, metadata.genderGroup])
        if (!groups.has(key)) groups.set(key, { bowType: metadata.bowType, distance: metadata.distance, genderGroup: metadata.genderGroup, label: metadata.label, members: new Set() })
        section = { metadata, group: groups.get(key), header: null, records: [] }
        continue
      }
      if (raw && /^(?:第\s*)?[一二三四五六七八九十\d]+\s*轮$/.test(raw)) {
        if (!section) throw errorAt(name, row, '轮次前缺少分组')
        section.metadata.round = raw.replace(/^第\s*/, '').replace(/\s*轮$/, '').trim()
        continue
      }
      if (raw && isNote(raw)) { flush(); continue }
      const targetHeaders = [...cells.values()].filter(cell => ['s', 'str'].includes(cell.t) && headerKind(String(cell.v)) === 'target').length
      if (targetHeaders) {
        if (!section) throw errorAt(name, row, '表头前缺少可识别的合并组名')
        if (merges.some(merge => merge.s.r <= row && merge.e.r >= row)) throw errorAt(name, row, '表头不应含合并单元格')
        section.header = parseHeader(cells, name, row)
        continue
      }
      if (!section || !section.header) throw errorAt(name, row, '无法识别的含内容行，或该组缺少四人站位表头')
      if (merges.some(merge => merge.s.r <= row && merge.e.r >= row)) throw errorAt(name, row, '站位数据行不应含合并单元格')
      const header = section.header
      if ([...cells.keys()].some(col => !header.allowed.has(col))) throw errorAt(name, row, '站位表头以外的列含数据，不能忽略')
      const positions = header.targets.map((col, index) => {
        const target = readText(cells.get(col), name, row, 'ABCD'[index] + '靶位')
        const club = readText(cells.get(col + 1), name, row, '俱乐部')
        const athlete = readText(cells.get(col + 2), name, row, '姓名')
        if (!target && (club || athlete)) throw errorAt(name, row, '有姓名或俱乐部但缺少靶位')
        if (target && !/^[1-9]\d*\s*[ABCD]$/i.test(target)) throw errorAt(name, row, '靶位应为数字加A/B/C/D，例如1A')
        if (athlete) section.group.members.add(JSON.stringify([athlete, club]))
        return { target, club, athlete }
      })
      if (!positions.some(position => position.target)) throw errorAt(name, row, '没有有效靶位，不能将损坏行当作空白行')
      const round = header.roundColumn == null ? section.metadata.round : readText(cells.get(header.roundColumn), name, row, '轮次') || section.metadata.round
      if (header.roundColumn != null && !round) throw errorAt(name, row, '显式轮次列不能为空')
      section.records.push({ row, round, positions })
    }
    flush()
  }
  if (!pages.length) throw new Error('站位表中没有有效排位记录')
  return { pages, groups: [...groups.values()].map(({ members, ...group }) => ({ ...group, participantCount: members.size, fingerprint: 'sha256:' + sha256(JSON.stringify([...members].sort())) })) }
}
