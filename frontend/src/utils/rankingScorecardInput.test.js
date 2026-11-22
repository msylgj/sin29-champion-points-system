import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx/xlsx.mjs'
import { MAX_SCORECARD_FILE_BYTES, parseRankingScorecardInput } from './rankingScorecardInput'

// All workbooks below are generated fictional examples, never user attachments.
const headers = ['页面', '组别', '轮次', ...['A', 'B', 'C', 'D'].flatMap(position => [position + '位', position + '俱乐部', position + '运动员'])]
const row = (overrides = {}) => {
  const values = { 页面: '', 组别: '虚构体验组', 轮次: '一', A位: '7A', A俱乐部: '云杉弓队', A运动员: '选手甲*', B位: '7B', B俱乐部: '', B运动员: '', C位: '7C', C俱乐部: '', C运动员: '选手丙', D位: '', D俱乐部: '', D运动员: '', ...overrides }
  return headers.map(label => values[label])
}
const worksheet = rows => XLSX.utils.aoa_to_sheet(rows)
const bytes = (rows, configure) => {
  const book = XLSX.utils.book_new()
  const sheet = worksheet(rows)
  configure?.(sheet, book)
  XLSX.utils.book_append_sheet(book, sheet, '虚构输入')
  return XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true })
}
const read = (rows, configure) => parseRankingScorecardInput(bytes(rows, configure))
const changeXml = (input, change) => {
  const zip = XLSX.CFB.read(new Uint8Array(input), { type: 'array' })
  const path = '/xl/worksheets/sheet1.xml'
  const xml = new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(zip, path).content))
  XLSX.CFB.utils.cfb_add(zip, path, new TextEncoder().encode(change(xml)))
  return XLSX.CFB.write(zip, { type: 'array', fileType: 'zip', compression: true })
}

describe('ranking scorecard Excel input', () => {
  it('reads the actual template shape without user data: long merged instructions, headers, styled blank tail and four slots', () => {
    const pages = read([
      ['⚠️填写需知：' + '仅供虚构测试，请按原表填写。'.repeat(20)], headers,
      row({ 页面: '页面9', A运动员: '  选手甲***  ', A俱乐部: '  云杉弓队  ' }),
      [], row({ 页面: '页面1', 轮次: '二' }),
    ], sheet => { sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 25 } }]; sheet['!ref'] = 'A1:Z1000' })
    expect(pages).toHaveLength(2)
    expect(pages[0]).toEqual({ group: '虚构体验组', round: '一', positions: [
      { target: '7A', club: '云杉弓队', athlete: '选手甲***' },
      { target: '7B', club: '', athlete: '' },
      { target: '7C', club: '', athlete: '选手丙' },
      { target: '', club: '', athlete: '' },
    ] })
    expect(pages.map(page => page.round)).toEqual(['一', '二'])
    expect(pages[0]).not.toHaveProperty('页面')
  })

  it('supports omitted optional page column and reordered headers while preserving ABCD order', () => {
    const order = headers.slice(1).reverse()
    const values = row()
    const pages = read([order, order.map(label => values[headers.indexOf(label)])])
    expect(pages[0].positions.map(position => position.target)).toEqual(['7A', '7B', '7C', ''])
  })

  it('keeps repeated groups and rounds as distinct physical rows instead of deduplicating or sorting by page', () => {
    const pages = read([headers, row({ 页面: '页面99', A运动员: '首位' }), row({ 页面: '页面1', A运动员: '次位' }), row({ 页面: '页面99', A运动员: '首位' })])
    expect(pages).toHaveLength(3)
    expect(pages.map(page => page.positions[0].athlete)).toEqual(['首位', '次位', '首位'])
    expect(pages[0]).toEqual(pages[2])
    expect(pages[0]).not.toBe(pages[2])
  })

  it('does not infer a new round, group, or target from an earlier row', () => {
    expect(() => read([headers, row(), row({ 轮次: '' })])).toThrow('第3行：轮次不能为空')
    expect(() => read([headers, row(), row({ 组别: '' })])).toThrow('第3行：组别不能为空')
  })

  it('keeps physical line numbers through truly blank rows and rejects populated broken rows', () => {
    expect(() => read([headers, row(), [], ['   '], row({ A位: '', A运动员: '有姓名但无靶位' })])).toThrow('第5行：A位有姓名或俱乐部但缺少靶位')
    expect(() => read([headers, ['页面2']])).toThrow('第2行：组别不能为空')
    expect(() => read([headers, row({ A位: '', A俱乐部: '', A运动员: '', B位: '', C位: '', C运动员: '' })])).toThrow('至少填写一个靶位')
  })

  it('does not discard instruction-looking or extra-column data after the header', () => {
    expect(() => read([headers, ['说明：这是一行损坏的测试数据']])).toThrow('第2行：组别不能为空')
    expect(() => read([headers, [...row(), '意外错位的内容']])).toThrow('第2行：未识别的P列含数据')
    expect(() => read([['非表头数据', '不应忽略'], headers, row()])).toThrow('第1行')
  })

  it('allows target-only seats, entirely empty seats, zero text and displayed numeric target formatting', () => {
    const pages = read([headers, row({ 轮次: 1, A位: { t: 'n', v: 7, z: '000' }, A俱乐部: '', A运动员: '', B位: 0, C运动员: '' })])
    expect(pages[0].round).toBe('1')
    expect(pages[0].positions[0]).toEqual({ target: '007', club: '', athlete: '' })
    expect(pages[0].positions[1].target).toBe('0')
    expect(pages[0].positions[3]).toEqual({ target: '', club: '', athlete: '' })
  })

  it('accepts repeated complete headers at the same coordinates but rejects missing, duplicate or displaced headers', () => {
    expect(read([headers, row(), headers, row({ 轮次: '二' })])).toHaveLength(2)
    expect(() => read([headers.slice(0, -1), row()])).toThrow('表头缺少：D运动员')
    expect(() => read([[...headers, '组别'], row()])).toThrow('表头“组别”重复')
    expect(() => read([headers, row(), [...headers].reverse(), row()])).toThrow('重复表头的列位置已改变')
  })

  it('never treats an athlete named like a header as a new header row', () => {
    expect(read([headers, row({ A运动员: '轮次' })])[0].positions[0].athlete).toBe('轮次')
  })

  it('reports data-area merges instead of silently filling or dropping partially merged records', () => {
    expect(() => read([headers, row(), row({ 轮次: '二' })], sheet => {
      sheet['!merges'] = [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }]
    })).toThrow('第2行：数据行含合并单元格')
  })

  it.each([
    ['公式', { t: 'n', v: 2, f: '1+1' }],
    ['Excel 错误', { t: 'e', v: 0x07 }],
    ['有效文本或数值', false],
  ])('reports %s cells rather than emitting stale or malformed player data', (message, value) => {
    expect(() => read([headers, row({ A运动员: value })])).toThrow(message)
  })

  it('preserves literal formula-looking names and clubs without executing anything', () => {
    const pages = read([headers, row({ A运动员: '=姓名*', A俱乐部: '+虚构俱乐部' })])
    expect(pages[0].positions[0].athlete).toBe('=姓名*')
    expect(pages[0].positions[0].club).toBe('+虚构俱乐部')
  })

  it('supports 120 Unicode characters and rejects the first overlong field with its physical row', () => {
    expect(read([headers, row({ A运动员: '星'.repeat(120) })])[0].positions[0].athlete).toHaveLength(120)
    expect(Array.from(read([headers, row({ A运动员: '🏹'.repeat(120) })])[0].positions[0].athlete)).toHaveLength(120)
    expect(() => read([headers, row(), row({ A运动员: '星'.repeat(121) })])).toThrow('第3行：A运动员最多允许120个字符')
    expect(() => read([headers, row({ 组别: '组'.repeat(121) })])).toThrow('组别最多允许120个字符')
    expect(() => read([headers, row({ 轮次: '轮'.repeat(121) })])).toThrow('轮次最多允许120个字符')
  })

  it('accepts 300 pages and reports the exact physical row of page 301', () => {
    expect(read([headers, ...Array.from({ length: 300 }, () => row())])).toHaveLength(300)
    expect(() => read([headers, ...Array.from({ length: 301 }, () => row())])).toThrow('第302行：最多允许300页')
  })

  it('rejects no effective records including headers with only styled or whitespace tails', () => {
    expect(() => read([headers, [], ['  ']], sheet => { sheet['!ref'] = 'A1:Z1000' })).toThrow('没有有效记分纸记录')
    expect(() => read([['填写说明：只有说明，没有表格']])).toThrow('没有有效记分纸记录')
    expect(() => read([])).toThrow('没有有效记分纸记录')
  })

  it('uses workbook sheet order and per-sheet physical row order without silently ignoring another populated sheet', () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, worksheet([headers, row({ 组别: '先出现的虚构组' })]), '甲')
    XLSX.utils.book_append_sheet(book, worksheet([]), '空白表')
    XLSX.utils.book_append_sheet(book, worksheet([headers, row({ 组别: '后出现的虚构组' })]), '乙')
    expect(parseRankingScorecardInput(XLSX.write(book, { type: 'array', bookType: 'xlsx' })).map(page => page.group)).toEqual(['先出现的虚构组', '后出现的虚构组'])
    XLSX.utils.book_append_sheet(book, worksheet([['损坏但有内容']]), '损坏表')
    expect(() => parseRankingScorecardInput(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))).toThrow('工作表“损坏表”第1行')
  })

  it('accepts typed-array views without reading unrelated bytes outside the view or mutating the input', () => {
    const source = new Uint8Array(bytes([headers, row()]))
    const padded = new Uint8Array(source.length + 20)
    padded.set(source, 10)
    const before = padded.slice()
    expect(parseRankingScorecardInput(padded.subarray(10, -10))).toHaveLength(1)
    expect(padded).toEqual(before)
  })
})

describe('scorecard input resource limits', () => {
  it('exports the exact UI file-size limit and rejects empty, wrong input types and oversized files before reading', () => {
    expect(MAX_SCORECARD_FILE_BYTES).toBe(10485760)
    expect(() => parseRankingScorecardInput(new ArrayBuffer(0))).toThrow('文件为空')
    expect(() => parseRankingScorecardInput('bad')).toThrow('有效的 Excel')
    expect(() => parseRankingScorecardInput(new Uint8Array(MAX_SCORECARD_FILE_BYTES + 1))).toThrow('不能超过10MiB')
  })

  it('rejects worksheet dimensions beyond row/column limits before SheetJS allocates a result', () => {
    expect(() => read([headers, row()], sheet => { sheet['!ref'] = 'A1:O5001' })).toThrow('使用范围过大')
    expect(() => read([headers, row()], sheet => { sheet['!ref'] = 'A1:BM2' })).toThrow('使用范围过大')
  })

  it('detects real out-of-range cells even when a forged dimension attempts to hide them', () => {
    const input = bytes([headers, row()])
    const changed = changeXml(input, value => value.replace('</sheetData>', '<row r="6000"><c r="A6000" t="str"><v>损坏行</v></c></row></sheetData>'))
    expect(() => parseRankingScorecardInput(changed)).toThrow('使用范围过大')
  })

  it('rejects a corrupt ZIP, encrypted members and implausible expanded sizes before inflation', () => {
    expect(() => parseRankingScorecardInput(new Uint8Array([0x50, 0x4b, 0, 0]))).toThrow('压缩包不完整')
    for (const change of ['size', 'encrypted']) {
      const input = new Uint8Array(bytes([headers, row()]))
      const view = new DataView(input.buffer)
      const offset = input.findIndex((_, index) => index + 4 <= input.length && view.getUint32(index, true) === 0x02014b50)
      if (change === 'size') view.setUint32(offset + 24, 0x10000000, true)
      else view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true)
      expect(() => parseRankingScorecardInput(input)).toThrow(change === 'size' ? '解压后内容过大' : '不支持加密')
    }
  })

  it('limits sheet count rather than silently skipping excess sheets', () => {
    const book = XLSX.utils.book_new()
    for (let index = 0; index < 17; index += 1) XLSX.utils.book_append_sheet(book, worksheet([headers, row()]), '表' + index)
    expect(() => parseRankingScorecardInput(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))).toThrow('工作表过多')
  })
})
