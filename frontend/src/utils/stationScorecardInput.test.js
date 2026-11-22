import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx/xlsx.mjs'
import { parseStationScorecards } from './stationScorecardInput'

// Generated fictional station sheets only. No attached athlete data is copied.
const title = text => ['', text]
const header = round => ['', ...Array.from({ length: 4 }, () => ['靶位号', '俱乐部', '姓名']).flat(), ...(round ? ['轮次'] : [])]
const seatRow = (number = 1, names = ['学员甲*', '', '学员丙', ''], clubs = ['云杉弓队', '', '白桦弓队', '']) => ['', ...['A', 'B', 'C', 'D'].flatMap((letter, index) => [number + letter, clubs[index], names[index]])]
const section = (label = 'C组10米反曲弓组', rows = [seatRow()], round = false) => [title(label), header(round), ...rows]
const workbookBytes = (sheets, bookType = 'xlsx') => {
  const book = XLSX.utils.book_new()
  for (const [index, config] of sheets.entries()) {
    const sheet = XLSX.utils.aoa_to_sheet(config.rows)
    sheet['!merges'] = config.merges ?? config.rows.flatMap((row, r) => row.filter(value => value != null && String(value).trim()).length === 1 && row[1] ? [{ s: { r, c: 1 }, e: { r, c: 12 } }] : [])
    if (config.range) sheet['!ref'] = config.range
    XLSX.utils.book_append_sheet(book, sheet, config.name || '虚构day' + index)
  }
  return XLSX.write(book, { type: 'array', bookType, compression: true })
}
const parse = rows => parseStationScorecards(workbookBytes([{ rows }]))

describe('station workbook physical sections and ranking pages', () => {
  it('reads both day sheets, merged titles/footers and repeated ABCD columns in physical date/section/round order', () => {
    const input = workbookBytes([
      { name: '先出现的比赛日', rows: [title('虚构冠军联赛\n2098赛季'), title('10.17比赛日站位表'), ...section('C组10米反曲弓组', [seatRow(1), seatRow(2)]), ...section('B组18米传统弓女子组', [seatRow(3)]), title('虚构运动协会\n2098.10')], range: 'B1:R191' },
      { name: '后出现的比赛日', rows: [title('10.18比赛日站位表'), ...section('B组30米复合弓组', [seatRow(4)]), title('虚构运动协会\n2098.10')] },
    ])
    const { pages, groups } = parseStationScorecards(input)
    expect(pages).toHaveLength(8)
    expect(pages.map(page => [page.group, page.round, page.positions[0].target])).toEqual([
      ['C组10米反曲弓组', '一', '1A'], ['C组10米反曲弓组', '一', '2A'], ['C组10米反曲弓组', '二', '1A'], ['C组10米反曲弓组', '二', '2A'],
      ['B组18米传统弓女子组', '一', '3A'], ['B组18米传统弓女子组', '二', '3A'], ['B组30米复合弓组', '一', '4A'], ['B组30米复合弓组', '二', '4A'],
    ])
    expect(groups.map(({ bowType, distance, genderGroup, participantCount }) => ({ bowType, distance, genderGroup, participantCount }))).toEqual([
      { bowType: 'recurve', distance: '10m', genderGroup: 'mixed', participantCount: 2 },
      { bowType: 'traditional', distance: '18m', genderGroup: 'women', participantCount: 2 },
      { bowType: 'compound', distance: '30m', genderGroup: 'mixed', participantCount: 2 },
    ])
    expect(pages.every(page => page.positions.length === 4)).toBe(true)
    pages[0].positions[0].athlete = '局部修改'
    expect(pages[2].positions[0].athlete).toBe('学员甲*')
  })

  it('preserves duplicate targets across categories rather than coalescing their people or blank positions', () => {
    const { pages, groups } = parse([...section('A组30米光弓女子组'), ...section('A组30米传统弓女子组')])
    expect(pages.map(page => page.positions[0].target)).toEqual(['1A', '1A', '1A', '1A'])
    expect(groups.map(group => group.bowType)).toEqual(['barebow', 'traditional'])
    expect(groups.map(group => group.participantCount)).toEqual([2, 2])
    expect(pages[0].positions[1]).toEqual({ target: '1B', club: '', athlete: '' })
  })

  it.each([
    ['C组18米复合弓组', 'compound', '18m', 'mixed'],
    ['B组30米复合弓组', 'compound', '30m', 'mixed'],
    ['C组10米无瞄弓男子组', 'sightless', '10m', 'men'],
    ['S组50米光弓组', 'barebow', '50m', 'mixed'],
    ['S组50米美猎弓组', 'longbow', '50m', 'mixed'],
    ['A组70米反曲弓女子组', 'recurve', '70m', 'women'],
  ])('extracts %s from actual distance and bow labels, never the prefix letter', (label, bowType, distance, genderGroup) => {
    expect(parse(section(label)).groups[0]).toMatchObject({ bowType, distance, genderGroup, label })
  })

  it('handles fully empty seats and target/club-only placeholders without counting them as athletes', () => {
    const row = seatRow(1, ['', '', '', ''], ['预留俱乐部', '', '', ''])
    row.splice(10, 3, '', '', '')
    const { pages, groups } = parse(section('C组10米反曲弓组', [row]))
    expect(groups[0].participantCount).toBe(0)
    expect(pages).toHaveLength(2)
    expect(pages[0].positions[0]).toEqual({ target: '1A', club: '预留俱乐部', athlete: '' })
    expect(pages[0].positions[3]).toEqual({ target: '', club: '', athlete: '' })
  })

  it('reads explicitly provided per-row rounds without duplicating them and rejects missing explicit rounds', () => {
    const rows = [title('C组10米反曲弓组'), header(true), [...seatRow(), '一'], [...seatRow(), '二']]
    expect(parse(rows).pages.map(page => page.round)).toEqual(['一', '二'])
    rows[3][13] = ''
    expect(() => parse(rows)).toThrow('第4行：显式轮次列不能为空')
  })

  it('uses title or standalone round markers, preserves physical segments and does not invent previous-row rounds', () => {
    const rows = [...section('C组10米反曲弓组（第一轮）'), ...section('C组10米反曲弓组（第二轮）')]
    const { pages, groups } = parse(rows)
    expect(pages.map(page => page.round)).toEqual(['一', '二'])
    expect(pages[0].group).toBe('C组10米反曲弓组')
    expect(groups).toHaveLength(1)
    expect(groups[0].participantCount).toBe(2)
    expect(parse([title('C组10米反曲弓组'), title('第一轮'), header(), seatRow(), title('第二轮'), seatRow()]).pages.map(page => page.round)).toEqual(['一', '二'])
    expect(() => parse([...section(), title('第二轮'), seatRow()])).toThrow('部分行缺少轮次')
  })

  it('trims fields but preserves internal text and asterisks, including literal formula-looking names', () => {
    const row = seatRow(1, ['  =学员甲***  ', '', '学员 丙', ''], ['  云杉弓队  ', '', '', ''])
    const { pages } = parse(section('C组10米反曲弓组', [row]))
    expect(pages[0].positions[0]).toEqual({ target: '1A', club: '云杉弓队', athlete: '=学员甲***' })
    expect(pages[0].positions[2].athlete).toBe('学员 丙')
  })
})

describe('station group membership identity and fingerprint', () => {
  it('deduplicates only exact name+club identities across same-group sections/days, not same name alone', () => {
    const input = workbookBytes([
      { rows: section('C组10米反曲弓组', [seatRow(1, ['同名学员', '同名学员', '', ''], ['俱乐部甲', '俱乐部乙', '', ''])]) },
      { rows: [...section('另一段10米反曲弓组', [seatRow(8, ['同名学员', '', '', ''], ['俱乐部甲', '', '', ''])]), ...section('B组18米反曲弓男子组')] },
    ])
    const { groups, pages } = parseStationScorecards(input)
    expect(groups).toHaveLength(2)
    expect(groups[0].participantCount).toBe(2)
    expect(groups[0].label).toBe('C组10米反曲弓组')
    expect(pages).toHaveLength(6)
    const identities = [JSON.stringify(['同名学员', '俱乐部甲']), JSON.stringify(['同名学员', '俱乐部乙'])].sort()
    expect(groups[0].fingerprint).toBe('sha256:' + createHash('sha256').update(JSON.stringify(identities)).digest('hex'))
    expect(groups[0].fingerprint).not.toContain('同名学员')
  })

  it('is stable under slot/order/target/day-label changes, but changes for same-size membership or club changes', () => {
    const first = parse(section()).groups[0]
    const reordered = seatRow(88, ['学员丙', '', '学员甲*', ''], ['白桦弓队', '', '云杉弓队', ''])
    const second = parse(section('另一段10米反曲弓组', [reordered])).groups[0]
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(parse(section('C组10米反曲弓组', [seatRow(1, ['学员乙', '', '学员丙', ''])])).groups[0].fingerprint).not.toBe(first.fingerprint)
    expect(parse(section('C组10米反曲弓组', [seatRow(1, undefined, ['其他俱乐部', '', '白桦弓队', ''])])).groups[0].fingerprint).not.toBe(first.fingerprint)
    const repeated = parse([...section(), ...section()]).groups[0]
    expect(repeated.fingerprint).toBe(first.fingerprint)
    expect(repeated.participantCount).toBe(first.participantCount)
  })

  it('hashes long Unicode membership sets with correct SHA-256 padding, not a lossy short fingerprint', () => {
    const names = ['🏹'.repeat(120), '测试学员'.repeat(20), '另一个学员', '第四位']
    const clubs = ['云杉', '白桦', '松树', '杉树']
    const { groups } = parse(section('C组10米反曲弓组', [seatRow(1, names, clubs)]))
    const canonical = JSON.stringify(names.map((name, index) => JSON.stringify([name, clubs[index]])).sort())
    expect(groups[0].fingerprint).toBe('sha256:' + createHash('sha256').update(canonical).digest('hex'))
  })
})

describe('station input diagnostics and limits', () => {
  it.each(['C组20米反曲弓组', 'C组1018米反曲弓组', 'C组10米未知弓组', '2026赛季C组10米未知弓组', 'C组10米反曲弓光弓组', 'C组10米反曲弓男子女子组'])('rejects unknown or ambiguous group %s instead of silently skipping it', label => {
    expect(() => parse(section(label))).toThrow('第1行：无法确定分组')
  })

  it('rejects CSV or text disguised as Excel instead of accepting SheetJS text autodetection', () => {
    const csv = ['C组10米反曲弓组', header().join(','), seatRow().join(',')].join('\n')
    expect(() => parseStationScorecards(new TextEncoder().encode(csv))).toThrow('不支持CSV或文本')
    expect(() => parseStationScorecards(new TextEncoder().encode('<html>假Excel</html>'))).toThrow('不支持CSV或文本')
  })

  it('reports damaged rows and unknown content with physical row numbers instead of swallowing them', () => {
    const broken = seatRow(); broken[1] = ''
    expect(() => parse([...section(), [], broken])).toThrow('第5行：有姓名或俱乐部但缺少靶位')
    expect(() => parse([title('随意非说明文字'), ...section()])).toThrow('第1行：无法识别')
    expect(() => parse([title('C组10米反曲弓组'), seatRow()])).toThrow('第2行：无法识别')
    expect(() => parse([...section(), [...seatRow(), '额外内容']])).toThrow('表头以外的列含数据')
  })

  it('rejects incomplete repeated headers, formulas, error values and data merges', () => {
    expect(() => parse([title('C组10米反曲弓组'), header().slice(0, 10), seatRow()])).toThrow('四组')
    const formula = seatRow(); formula[3] = { t: 'n', v: 2, f: '1+1' }
    expect(() => parse(section('C组10米反曲弓组', [formula]))).toThrow('含公式')
    const error = seatRow(); error[3] = { t: 'e', v: 0x07 }
    expect(() => parse(section('C组10米反曲弓组', [error]))).toThrow('含错误值')
    const input = workbookBytes([{ rows: section(), merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 12 } }, { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } }] }])
    expect(() => parseStationScorecards(input)).toThrow('数据行不应含合并单元格')
  })

  it('limits output to 300 pages after implicit two-round expansion and preserves blank rows', () => {
    expect(parse(section('C组10米反曲弓组', Array.from({ length: 150 }, (_, i) => seatRow(i + 1)))).pages).toHaveLength(300)
    expect(() => parse(section('C组10米反曲弓组', Array.from({ length: 151 }, (_, i) => seatRow(i + 1))))).toThrow('最多300页')
    expect(parse([...section(), [], ['  ']]).pages).toHaveLength(2)
  })

  it('enforces text, byte, sheet-range and worksheet-count limits before accepting invalid input', () => {
    expect(() => parse(section('C组10米反曲弓组', [seatRow(1, ['字'.repeat(121), '', '', ''])]))).toThrow('最多允许120个字符')
    expect(() => parseStationScorecards(new Uint8Array(10485761))).toThrow('不能超过10MiB')
    expect(() => parseStationScorecards(new Uint8Array(0))).toThrow('站位表为空')
    expect(() => parseStationScorecards({})).toThrow('有效的 Excel')
    expect(() => parseStationScorecards(workbookBytes([{ rows: section(), range: 'B1:R5001' }]))).toThrow('范围过大')
    expect(() => parseStationScorecards(workbookBytes(Array.from({ length: 17 }, () => ({ rows: section() }))))).toThrow('16张工作表')
  })

  it('accepts genuine legacy Excel containers without re-enabling text autodetection', () => {
    const output = parseStationScorecards(workbookBytes([{ rows: section() }], 'biff8'))
    expect(output.pages).toHaveLength(2)
    expect(output.groups[0].participantCount).toBe(2)
  })

  it('rejects implausible expanded ZIP content and actual out-of-range rows despite forged dimensions', () => {
    const original = new Uint8Array(workbookBytes([{ rows: section() }]))
    const corrupted = original.slice()
    const view = new DataView(corrupted.buffer)
    const offset = corrupted.findIndex((_, index) => index + 4 <= corrupted.length && view.getUint32(index, true) === 0x02014b50)
    view.setUint32(offset + 24, 0x10000000, true)
    expect(() => parseStationScorecards(corrupted)).toThrow('64MiB')
    const zip = XLSX.CFB.read(original, { type: 'array' })
    const path = '/xl/worksheets/sheet1.xml'
    const xml = new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(zip, path).content))
    XLSX.CFB.utils.cfb_add(zip, path, new TextEncoder().encode(xml.replace('</sheetData>', '<row r="6000"><c r="B6000" t="str"><v>损坏行</v></c></row></sheetData>')))
    expect(() => parseStationScorecards(XLSX.CFB.write(zip, { type: 'array', fileType: 'zip' }))).toThrow('5000行')
  })

  it('does not modify input bytes, supports typed-array views and reports no valid records', () => {
    const source = new Uint8Array(workbookBytes([{ rows: section() }]))
    const padded = new Uint8Array(source.length + 12); padded.set(source, 6)
    const before = padded.slice()
    expect(parseStationScorecards(padded.subarray(6, -6)).pages).toHaveLength(2)
    expect(padded).toEqual(before)
    expect(() => parse([title('虚构冠军联赛'), title('虚构运动协会')])).toThrow('没有有效排位记录')
  })
})
