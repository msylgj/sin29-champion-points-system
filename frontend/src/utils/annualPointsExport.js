import { sumPointTenths } from './seasonPointsExport'
import { downloadWorkbook, getBowPalette, getStationLabel } from './pointsWorkbook'

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

const escapeXml = value => String(value ?? '')
  // XML 1.0 does not allow these control characters in text cells.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const numeric = value => {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) throw new Error('年度积分数据无效')
  return number
}
const textWidth = value => Math.max(...String(value ?? '').split('\n').map(line =>
  Array.from(line).reduce((width, character) => width + (character.codePointAt(0) > 255 ? 2 : 1), 0)))
const columnWidth = (rows, column, minimum, maximum) => rows.reduce((width, row) =>
  Math.min(maximum, Math.max(width, textWidth(row[column]) + 3)), minimum)

/** Build the annual ranking XLSX without SheetJS CE dropping custom ranking styles. */
export function buildAnnualWorkbook(XLSX, {
  ranking = [], events = [], year, bowType, bowTypeLabel,
}) {
  const headers = ['排名', '姓名', '俱乐部', ...events.map(event =>
    getStationLabel(event.shortLabel || event.label) + '积分'), '年度总积分']
  const rows = ranking.map((athlete, index) => {
    const byEvent = new Map()
    for (const score of athlete.scores || []) {
      const key = String(score.event_id)
      if (!byEvent.has(key)) byEvent.set(key, [])
      byEvent.get(key).push(score)
    }
    return [
      athlete.ranking ?? index + 1, athlete.name || '', athlete.club || '',
      ...events.map(event => byEvent.has(String(event.value)) ? sumPointTenths(byEvent.get(String(event.value))) / 10 : ''),
      numeric(athlete.total_points),
    ]
  })

  // SheetJS creates the package; write the styled ranking sheet below.
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['']]), '排名列表')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true })
  const zip = XLSX.CFB.read(new Uint8Array(bytes), { type: 'array' })
  const getXml = path => {
    const entry = XLSX.CFB.find(zip, '/' + path)
    if (!entry) throw new Error('年度导出工作簿不完整')
    return new TextDecoder().decode(new Uint8Array(entry.content))
  }
  const putXml = (path, xml) => XLSX.CFB.utils.cfb_add(zip, '/' + path, new TextEncoder().encode(xml))
  let styles = getXml('xl/styles.xml')
  const appendStyles = (tag, children) => {
    const pattern = new RegExp('<' + tag + '([^>]*)>(.*?)</' + tag + '>', 's')
    const original = styles.match(pattern)
    if (!original) {
      if (tag !== 'numFmts') throw new Error('年度导出样式不完整')
      styles = styles.replace('<fonts', '<numFmts count="' + children.length + '">' + children.join('') + '</numFmts><fonts')
      return 0
    }
    const count = Number(original[1].match(/\bcount="(\d+)"/)[1])
    const attributes = original[1].replace(/\bcount="\d+"/, 'count="' + (count + children.length) + '"')
    styles = styles.replace(pattern, '<' + tag + attributes + '>' + original[2] + children.join('') + '</' + tag + '>')
    return count
  }
  const customFormats = Array.from(styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"/g), match => Number(match[1]))
  const decimalFormat = Math.max(163, ...customFormats) + 1
  appendStyles('numFmts', ['<numFmt numFmtId="' + decimalFormat + '" formatCode="0.0"/>'])
  const font = (size, bold = false) => '<font>' + (bold ? '<b/>' : '') + '<sz val="' + size + '"/><color rgb="FF000000"/><name val="宋体"/><charset val="134"/></font>'
  const fontId = appendStyles('fonts', [font(12), font(12, true), font(16, true)])
  const palette = getBowPalette(bowType, bowTypeLabel)
  const fill = color => '<fill><patternFill patternType="solid"><fgColor rgb="' + color + '"/><bgColor indexed="64"/></patternFill></fill>'
  const fillId = appendStyles('fills', [fill(palette.header), fill('FFFFFFFF'), fill(palette.stripe)])
  const edge = side => '<' + side + ' style="thin"><color rgb="FF333333"/></' + side + '>'
  const borderId = appendStyles('borders', ['<border>' + ['left', 'right', 'top', 'bottom'].map(edge).join('') + '<diagonal/></border>'])
  const xf = (fontOffset, fillOffset, format) => '<xf numFmtId="' + format + '" fontId="' + (fontId + fontOffset) + '" fillId="' + (fillId + fillOffset) + '" borderId="' + borderId + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  const styleId = appendStyles('cellXfs', [
    xf(2, 0, 0), xf(1, 0, 0),
    xf(0, 1, 1), xf(0, 1, decimalFormat), xf(0, 2, 1), xf(0, 2, decimalFormat),
  ])
  putXml('xl/styles.xml', styles)

  const widths = headers.map((header, index) => columnWidth([headers, ...rows], index, index === 0 ? 7 : 13, index === 0 ? 12 : 22))
  widths[1] = columnWidth(rows, 1, 14, 60)
  const otherWidth = widths.reduce((sum, width, index) => sum + (index === 2 ? 0 : width), 0)
  widths[2] = Math.min(80, Math.max(columnWidth(rows, 2, 24, 80), Math.ceil(otherWidth * 0.4)))
  const lastColumn = XLSX.utils.encode_col(headers.length - 1)
  const cellXml = (column, row, value, style) => {
    const attributes = 'r="' + XLSX.utils.encode_col(column) + row + '" s="' + style + '"'
    if (value === '' || value == null) return '<c ' + attributes + '/>'
    if (typeof value === 'number') return '<c ' + attributes + '><v>' + numeric(value) + '</v></c>'
    // Explicit inline strings never execute a formula-looking name or club.
    return '<c ' + attributes + ' t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + '</t></is></c>'
  }
  const title = '杭州弓箭俱乐部冠军联赛\n' + (year ?? '') + '赛季' + (bowTypeLabel || bowType || '') + '积分排名'
  const titleCells = headers.map((_, column) => cellXml(column, 1, column ? '' : title, styleId)).join('')
  const headerCells = headers.map((header, column) => cellXml(column, 2, header, styleId + 1)).join('')
  const dataRows = rows.map((row, index) => {
    const cells = row.map((value, column) => cellXml(column, index + 3, value,
      styleId + 2 + (index % 2) * 2 + Number(typeof value === 'number' && !Number.isInteger(value)))).join('')
    const lineCount = row.reduce((maximum, value, column) => Math.max(maximum,
      String(value ?? '').split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(textWidth(line) / Math.max(1, widths[column] - 2))), 0)), 1)
    const height = Math.min(409, Math.max(24, lineCount * 18))
    return '<row r="' + (index + 3) + '" ht="' + height + '" customHeight="1">' + cells + '</row>'
  }).join('')
  const lastRow = rows.length + 2
  putXml('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="' + MAIN_NS + '"><dimension ref="A1:' + lastColumn + lastRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="24"/><cols>' + widths.map((width, column) => '<col min="' + (column + 1) + '" max="' + (column + 1) + '" width="' + width + '" customWidth="1"/>').join('') + '</cols>' +
    '<sheetData><row r="1" ht="52.5" customHeight="1">' + titleCells + '</row><row r="2" ht="30" customHeight="1">' + headerCells + '</row>' + dataRows + '</sheetData>' +
    '<autoFilter ref="A2:' + lastColumn + lastRow + '"/><mergeCells count="1"><mergeCell ref="A1:' + lastColumn + '1"/></mergeCells>' +
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>')
  return new Uint8Array(XLSX.CFB.write(zip, { type: 'array', fileType: 'zip', compression: true }))
}

export function exportAnnualPoints(XLSX, options) {
  const bytes = buildAnnualWorkbook(XLSX, options)
  downloadWorkbook(bytes, options.filename)
}
