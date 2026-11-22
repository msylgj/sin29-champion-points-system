import * as XLSX from 'xlsx/xlsx.mjs'

export const MAX_SCORECARD_FILE_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 300
const MAX_TEXT_LENGTH = 120
const MAX_ROWS = 5000
const MAX_COLUMNS = 64
const MAX_SHEETS = 16
const MAX_ZIP_ENTRIES = 1000
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024
const POSITIONS = ['A', 'B', 'C', 'D']
const REQUIRED_HEADERS = ['组别', '轮次', ...POSITIONS.flatMap(position => [position + '位', position + '俱乐部', position + '运动员'])]
const KNOWN_HEADERS = new Set([...REQUIRED_HEADERS, '页面'])

const rowError = (sheet, row, message) => new Error('工作表“' + sheet + '”第' + (row + 1) + '行：' + message)
const hasValue = cell => !!cell && (cell.f != null || cell.t === 'e' || cell.t === 'b' || (cell.v != null && String(cell.v).trim() !== ''))
const text = (cell, sheet, row, field) => {
  if (!cell || !hasValue(cell)) return ''
  if (cell.f != null) throw rowError(sheet, row, field + '含公式，请先转换为文本或数值')
  if (cell.t === 'e') throw rowError(sheet, row, field + '含 Excel 错误值，请修正')
  if (!['s', 'str', 'n'].includes(cell.t) || (cell.t === 'n' && !Number.isFinite(cell.v))) throw rowError(sheet, row, field + '不是有效文本或数值')
  const value = String(cell.t === 'n' ? cell.w ?? cell.v : cell.v).trim()
  if (Array.from(value).length > MAX_TEXT_LENGTH) throw rowError(sheet, row, field + '最多允许120个字符')
  return value
}
const normalizeHeader = value => value.replace(/\s+/g, '').replace(/^[a-d]/, letter => letter.toUpperCase()).replace(/^页码$/, '页面')
const isInstruction = cells => {
  if (cells.size !== 1) return false
  const cell = cells.values().next().value
  if (cell.f != null || !['s', 'str'].includes(cell.t)) return false
  return /^(?:⚠️?\s*)?(?:填写需知|填写须知|填写说明|填表说明|使用说明|说明[:：])/.test(String(cell.v).trim())
}

const checkAddress = (address, sheet) => {
  if (!/^[A-Z]+[1-9]\d*$/i.test(address)) throw new Error('工作表“' + sheet + '”含无效单元格范围')
  const decoded = XLSX.utils.decode_cell(address.toUpperCase())
  if (decoded.r >= MAX_ROWS || decoded.c >= MAX_COLUMNS) throw new Error('工作表“' + sheet + '”使用范围过大（最多5000行、64列），请清除多余内容或格式')
  return decoded
}
const checkRange = (range, sheet) => {
  if (!range) return
  const parts = range.split(':')
  if (parts.length > 2) throw new Error('工作表“' + sheet + '”含无效单元格范围')
  parts.forEach(part => checkAddress(part.replace(/\$/g, ''), sheet))
}

// Reject implausibly large ZIP metadata before any XML inflation. This is a
// bounded client-side safeguard, not a substitute for server request limits.
const checkZip = bytes => {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break }
  }
  if (end < 0) throw new Error('Excel 压缩包不完整，请重新保存文件')
  const count = view.getUint16(end + 10, true)
  const length = view.getUint32(end + 12, true)
  let offset = view.getUint32(end + 16, true)
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || count > MAX_ZIP_ENTRIES || offset + length !== end) throw new Error('Excel 压缩包结构异常或文件项目过多')
  let expanded = 0
  for (let entry = 0; entry < count; entry += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Excel 压缩包目录损坏')
    expanded += view.getUint32(offset + 24, true)
    if (expanded > MAX_EXPANDED_BYTES) throw new Error('Excel 解压后内容过大，请减少多余内容或格式')
    if (view.getUint16(offset + 8, true) & 1) throw new Error('不支持加密的 Excel，请先取消密码保护')
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  if (offset !== end) throw new Error('Excel 压缩包目录损坏')
  return true
}
const checkXmlRanges = bytes => {
  const archive = XLSX.CFB.read(bytes, { type: 'array' })
  let worksheets = 0
  archive.FullPaths.forEach((path, index) => {
    if (!/\/xl\/worksheets\/[^/]+\.xml$/.test(path)) return
    if (++worksheets > MAX_SHEETS) throw new Error('Excel 工作表过多，最多允许16张')
    const content = new Uint8Array(archive.FileIndex[index].content)
    const encoding = content[0] === 0xff && content[1] === 0xfe ? 'utf-16le' : content[0] === 0xfe && content[1] === 0xff ? 'utf-16be' : 'utf-8'
    const xml = new TextDecoder(encoding).decode(content)
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持含自定义 XML 实体的 Excel')
    const sheet = path.split('/').pop()
    for (const match of xml.matchAll(/<(?:\w+:)?dimension\b[^>]*\bref=["']([^"']+)["']/g)) checkRange(match[1], sheet)
    for (const match of xml.matchAll(/<(?:\w+:)?(?:row|c)\b[^>]*\br=["']([^"']+)["']/g)) {
      if (/^[1-9]\d*$/.test(match[1])) {
        if (Number(match[1]) > MAX_ROWS) throw new Error('工作表“' + sheet + '”使用范围过大（最多5000行、64列）')
      } else checkAddress(match[1], sheet)
    }
  })
}

const parseSheet = (sheet, name, pages) => {
  if (!sheet || typeof sheet !== 'object') throw new Error('工作表“' + name + '”无法读取，请使用普通数据工作表')
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
  let columns = null
  for (const [row, cells] of [...rows].sort(([a], [b]) => a - b)) {
    if (!columns && isInstruction(cells)) continue
    const labels = [...cells.values()].filter(cell => ['s', 'str'].includes(cell.t)).map(cell => normalizeHeader(String(cell.v).trim()))
    const headerLike = labels.includes('组别') && labels.includes('轮次') && labels.includes('A位')
    if (!columns || headerLike) {
      const candidate = new Map()
      for (const [column, cell] of cells) {
        const label = normalizeHeader(text(cell, name, row, '表头'))
        if (!KNOWN_HEADERS.has(label)) throw rowError(name, row, '无法识别表头“' + label + '”，请使用记分纸输入表格')
        if (candidate.has(label)) throw rowError(name, row, '表头“' + label + '”重复')
        candidate.set(label, column)
      }
      const missing = REQUIRED_HEADERS.filter(label => !candidate.has(label))
      if (missing.length) throw rowError(name, row, '表头缺少：' + missing.join('、'))
      if (columns && [...candidate].some(([label, column]) => columns.get(label) !== column)) throw rowError(name, row, '重复表头的列位置已改变，请修正')
      columns = candidate
      continue
    }
    for (const column of cells.keys()) {
      if (![...columns.values()].includes(column)) throw rowError(name, row, '未识别的' + XLSX.utils.encode_col(column) + '列含数据，请检查表格是否错位')
    }
    if (merges.some(merge => merge.s.r <= row && merge.e.r >= row)) throw rowError(name, row, '数据行含合并单元格，请先拆分并逐行填写组别和轮次')
    const get = label => text(cells.get(columns.get(label)), name, row, label)
    // The optional page column is validated but never used for sorting/dedup.
    if (columns.has('页面')) get('页面')
    const group = get('组别')
    const round = get('轮次')
    if (!group) throw rowError(name, row, '组别不能为空')
    if (!round) throw rowError(name, row, '轮次不能为空，请逐行填写，不能自动沿用上一行')
    const positions = POSITIONS.map(position => {
      const target = get(position + '位')
      const club = get(position + '俱乐部')
      const athlete = get(position + '运动员')
      if (!target && (club || athlete)) throw rowError(name, row, position + '位有姓名或俱乐部但缺少靶位')
      return { target, club, athlete }
    })
    if (!positions.some(position => position.target)) throw rowError(name, row, '至少填写一个靶位；含内容的损坏行不能当作空白行忽略')
    if (pages.length >= MAX_PAGES) throw rowError(name, row, '最多允许300页记分纸，请拆分文件')
    // Repeated target groups/rounds remain separate physical pages intentionally.
    pages.push({ group, round, positions })
  }
}

/** Parse without saving any input workbook, player data, or generated files. */
export function parseRankingScorecardInput(arrayBuffer) {
  let bytes
  if (Object.prototype.toString.call(arrayBuffer) === '[object ArrayBuffer]') bytes = new Uint8Array(arrayBuffer)
  else if (ArrayBuffer.isView(arrayBuffer)) bytes = new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength)
  else throw new Error('请选择有效的 Excel 文件')
  if (!bytes.length) throw new Error('Excel 文件为空')
  if (bytes.length > MAX_SCORECARD_FILE_BYTES) throw new Error('Excel 文件不能超过10MiB')
  let workbook
  try {
    if (checkZip(bytes)) checkXmlRanges(bytes)
    workbook = XLSX.read(bytes, { type: 'array', sheetRows: MAX_ROWS + 1, cellFormula: true, cellText: true, cellNF: true })
  } catch (error) {
    throw new Error('无法读取 Excel：' + (error?.message || '文件损坏或格式不支持'))
  }
  if (!workbook.SheetNames.length) throw new Error('Excel 中没有工作表')
  if (workbook.SheetNames.length > MAX_SHEETS) throw new Error('Excel 工作表过多，最多允许16张')
  const pages = []
  for (const name of workbook.SheetNames) parseSheet(workbook.Sheets[name], name, pages)
  if (!pages.length) throw new Error('Excel 中没有有效记分纸记录，请检查表头下的数据行')
  return pages
}
