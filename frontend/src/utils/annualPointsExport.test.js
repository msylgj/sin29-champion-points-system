import { afterEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { buildAnnualWorkbook, exportAnnualPoints } from './annualPointsExport'
import { getBowPalette } from './pointsWorkbook'

const events = [
  { value: '17', shortLabel: '春季赛', label: '2031 春季赛' },
  { value: '29', shortLabel: '夏季赛', label: '2031 夏季赛' },
  { value: '53', shortLabel: '秋季赛', label: '2031 秋季赛' },
  { value: '91', shortLabel: '冬季赛', label: '2031 冬季赛' },
]
const ranking = [
  { ranking: 5, name: '张三', club: '甲俱乐部', total_points: 8.9, scores: [
    { event_id: 17, points: 0.25 }, { event_id: 17, points: 0.18 }, { event_id: 17, points: 0.24 },
    { event_id: 29, points: 0 }, { event_id: '91', points: 3.5 }, { event_id: 999, points: 99 },
  ] },
  { ranking: 9, name: '李四', club: '', total_points: 0, scores: [{ event_id: 53, points: 0 }] },
]
const options = overrides => ({ year: 2031, bowType: 'recurve', bowTypeLabel: '反曲弓', ranking, events, ...overrides })
const xml = (bytes, path) => {
  const zip = XLSX.CFB.read(bytes, { type: 'array' })
  return new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(zip, '/' + path).content))
}
const documentXml = (bytes, path) => {
  const document = new DOMParser().parseFromString(xml(bytes, path), 'application/xml')
  expect(document.querySelector('parsererror')).toBeNull()
  return document
}
const make = overrides => {
  const bytes = buildAnnualWorkbook(XLSX, options(overrides))
  const book = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true })
  return { bytes, book, sheet: book.Sheets['排名列表'] }
}
const cellStyle = (bytes, ref) => {
  const sheet = documentXml(bytes, 'xl/worksheets/sheet1.xml')
  const styles = documentXml(bytes, 'xl/styles.xml')
  const index = Number(sheet.querySelector('c[r="' + ref + '"]').getAttribute('s'))
  const xf = styles.querySelector('cellXfs').children[index]
  const fill = styles.querySelector('fills').children[Number(xf.getAttribute('fillId'))]
  const border = styles.querySelector('borders').children[Number(xf.getAttribute('borderId'))]
  const font = styles.querySelector('fonts').children[Number(xf.getAttribute('fontId'))]
  return { xf, fill, border, font }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('annual ranking workbook roundtrip', () => {
  it('uses the requested year, merged two-line title, all actual station columns and annual total', () => {
    const { bytes, book, sheet } = make()
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(book.SheetNames).toEqual(['排名列表'])
    expect(XLSX.CFB.find(XLSX.CFB.read(bytes, { type: 'array' }), '/xl/worksheets/sheet2.xml')).toBeNull()
    expect(sheet.A1.v).toBe('杭州弓箭俱乐部冠军联赛\n2031赛季反曲弓积分排名')
    expect(sheet['!merges'].map(range => XLSX.utils.encode_range(range))).toEqual(['A1:H1'])
    expect(['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2'].map(key => sheet[key].v)).toEqual(['排名', '姓名', '俱乐部', '第一站积分', '第二站积分', '第三站积分', '第四站积分', '年度总积分'])
    expect(sheet['!ref']).toBe('A1:H4')
    expect(sheet.A3).toMatchObject({ t: 'n', v: 5 })
    expect(sheet.A4.v).toBe(9)
    expect(documentXml(bytes, 'xl/worksheets/sheet1.xml').querySelector('row[r="1"]').getAttribute('ht')).toBe('52.5')
  })

  it('sums rounded components per event ID, keeps missing events blank, and uses authoritative annual totals', () => {
    const { sheet } = make()
    expect(sheet.D3).toMatchObject({ t: 'n', v: 0.7, w: '0.7' })
    expect(sheet.E3).toMatchObject({ t: 'n', v: 0, w: '0' })
    expect(sheet.F3?.v).toBeUndefined()
    expect(sheet.G3).toMatchObject({ t: 'n', v: 3.5 })
    // This intentionally differs from the sum of visible scores: do not recompute it.
    expect(sheet.H3).toMatchObject({ t: 'n', v: 8.9, w: '8.9' })
    expect(sheet.D4?.v).toBeUndefined()
    expect(sheet.F4).toMatchObject({ t: 'n', v: 0, w: '0' })
    expect(sheet.H4).toMatchObject({ t: 'n', v: 0, w: '0' })
  })

  it('does not drop all-empty event columns when rankings are filtered', () => {
    const { sheet } = make({ ranking: [ranking[1]] })
    expect(sheet.D2.v).toBe('第一站积分')
    expect(sheet.E2.v).toBe('第二站积分')
    expect(sheet.G2.v).toBe('第四站积分')
    expect(sheet.D3?.v).toBeUndefined()
    expect(sheet.G3?.v).toBeUndefined()
    expect(sheet.H3.v).toBe(0)
  })

  it('has genuinely dynamic events, titles, columns beyond Z, and no fixed three-station assumption', () => {
    const extra = Array.from({ length: 26 }, (_, i) => ({ value: String(200 + i), shortLabel: '附加赛事' + i }))
    const allEvents = [...events, ...extra]
    const { sheet } = make({ year: 2045, events: allEvents, ranking: [{ ranking: 1, name: '选手', total_points: 7, scores: [{ event_id: 225, points: 7 }] }] })
    expect(sheet.A1.v).toContain('2045赛季')
    expect(sheet.AG2.v).toBe('附加赛事25积分')
    expect(sheet.AG3.v).toBe(7)
    expect(sheet.AH2.v).toBe('年度总积分')
    expect(sheet['!ref']).toBe('A1:AH3')
    expect(sheet['!merges'].map(range => XLSX.utils.encode_range(range))).toEqual(['A1:AH1'])
  })

  it('supports no athletes and no events without adding fake rows or stations', () => {
    const { sheet } = make({ ranking: [], events: [] })
    expect(sheet['!ref']).toBe('A1:D2')
    expect(sheet.D2.v).toBe('年度总积分')
    expect(sheet.A3).toBeUndefined()
    const noScores = make({ ranking: [{ ranking: 1, name: '未参赛', total_points: 0 }] }).sheet
    expect(noScores.D3?.v).toBeUndefined()
    expect(noScores.H3).toMatchObject({ t: 'n', v: 0, w: '0' })
  })

  it('preserves integer values without meaningless decimal points and decimal values as numbers', () => {
    const { sheet } = make({ ranking: [{ ranking: 1, name: '甲', total_points: '21.0', scores: [{ event_id: 17, points: 12 }, { event_id: 29, points: 1.5 }] }] })
    expect(sheet.D3).toMatchObject({ t: 'n', v: 12, z: '0', w: '12' })
    expect(sheet.E3).toMatchObject({ t: 'n', v: 1.5, z: '0.0', w: '1.5' })
    expect(sheet.H3).toMatchObject({ t: 'n', v: 21, z: '0', w: '21' })
  })

  it('keeps formula-looking names and club names as escaped non-formula text', () => {
    const name = '=HYPERLINK("https://example.invalid", "恶意") & <甲>'
    const club = '+SUM(1,2) & <俱乐部>'
    const { bytes, sheet } = make({ ranking: [{ ranking: 1, name, club, total_points: 0 }] })
    expect(sheet.B3).toMatchObject({ t: 's', v: name })
    expect(sheet.C3).toMatchObject({ t: 's', v: club })
    expect(sheet.B3.f).toBeUndefined()
    expect(sheet.C3.f).toBeUndefined()
    expect(documentXml(bytes, 'xl/worksheets/sheet1.xml').querySelector('f')).toBeNull()
    expect(xml(bytes, 'xl/worksheets/sheet1.xml')).toContain('&lt;甲&gt;')
  })

  it('does not mutate supplied frozen ranking or event arrays', () => {
    const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
    const input = freeze(JSON.parse(JSON.stringify(options())))
    expect(() => buildAnnualWorkbook(XLSX, input)).not.toThrow()
  })

  it('rejects invalid numeric totals rather than serializing invalid numeric cells', () => {
    expect(() => make({ ranking: [{ ranking: 1, total_points: Infinity }] })).toThrow('年度积分数据无效')
  })
})

describe('annual workbook OOXML visual contract', () => {
  it.each(['traditional', 'barebow', 'longbow', 'compound', 'recurve', 'unknown'])('persists the shared %s theme, white first row, zebra stripes and centered thin borders', bowType => {
    const { bytes } = make({ bowType, bowTypeLabel: bowType === 'unknown' ? '其他弓种' : undefined })
    const palette = getBowPalette(bowType, bowType === 'unknown' ? '其他弓种' : undefined)
    for (const ref of ['A1', 'H1', 'A2', 'H2']) expect(cellStyle(bytes, ref).fill.querySelector('fgColor').getAttribute('rgb')).toBe(palette.header)
    expect(cellStyle(bytes, 'A3').fill.querySelector('fgColor').getAttribute('rgb')).toBe('FFFFFFFF')
    expect(cellStyle(bytes, 'H4').fill.querySelector('fgColor').getAttribute('rgb')).toBe(palette.stripe)
    for (const ref of ['A1', 'D2', 'C3', 'H4']) {
      const { xf, border } = cellStyle(bytes, ref)
      for (const side of ['left', 'right', 'top', 'bottom']) {
        expect(border.querySelector(side).getAttribute('style')).toBe('thin')
        expect(border.querySelector(side + ' color').getAttribute('rgb')).toBe('FF333333')
      }
      expect(xf.querySelector('alignment').getAttribute('horizontal')).toBe('center')
      expect(xf.querySelector('alignment').getAttribute('vertical')).toBe('center')
      expect(xf.querySelector('alignment').getAttribute('wrapText')).toBe('1')
    }
    expect(cellStyle(bytes, 'A1').font.querySelector('b')).not.toBeNull()
    expect(cellStyle(bytes, 'A1').font.querySelector('sz').getAttribute('val')).toBe('16')
  })

  it('uses label-based shared palette fallback when a stable bow code is unavailable', () => {
    const { bytes } = make({ bowType: '', bowTypeLabel: '传统弓' })
    expect(cellStyle(bytes, 'A1').fill.querySelector('fgColor').getAttribute('rgb')).toBe(getBowPalette('traditional').header)
  })

  it('makes the club column about 28-30 percent of normal sheet width and wraps long names without clipping', () => {
    const { bytes, sheet } = make()
    const widths = sheet['!cols'].map(column => column.width)
    expect(widths[2] / widths.reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(0.28)
    expect(widths[2] / widths.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(0.31)
    const long = '很长的姓名'.repeat(20)
    const output = make({ ranking: [{ ranking: 1, name: long, club: '很长的俱乐部'.repeat(12), total_points: 0 }] })
    expect(output.sheet.B3.v).toBe(long)
    expect(Number(documentXml(output.bytes, 'xl/worksheets/sheet1.xml').querySelector('row[r="3"]').getAttribute('ht'))).toBeGreaterThan(24)
    expect(cellStyle(output.bytes, 'B3').xf.querySelector('alignment').getAttribute('wrapText')).toBe('1')
    expect(documentXml(bytes, 'xl/worksheets/sheet1.xml').querySelector('pane').getAttribute('topLeftCell')).toBe('A3')
  })
})

describe('annual download wrapper', () => {
  it('downloads real workbook bytes with the requested filename and cleans the object URL', () => {
    const create = vi.fn(() => 'blob:annual-points')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('2031年年度积分.xlsx')
      expect(this.href).toBe('blob:annual-points')
    })
    exportAnnualPoints(XLSX, { ...options(), filename: '2031年年度积分.xlsx' })
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(create.mock.calls[0][0].size).toBeGreaterThan(1000)
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:annual-points')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
