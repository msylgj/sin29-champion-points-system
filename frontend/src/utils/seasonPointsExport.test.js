import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { buildSeasonWorkbook, exportSeasonPoints, pointTenths, sumPointTenths } from './seasonPointsExport'

const templatePath = '../assets/season-export-template.xlsx'
const template = readFileSync(new URL(templatePath, import.meta.url))
const score = (distance, format, points, event_id = 1) => ({ distance, format, points, event_id })
const options = ranking => ({ ranking, eventId: '1', eventLabel: '春季赛', year: 2026, bowTypeLabel: '反曲弓' })
const readExport = ranking => {
  const bytes = buildSeasonWorkbook(XLSX, template, options(ranking))
  const book = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true })
  return { bytes, book, sheet: book.Sheets[book.SheetNames[0]] }
}
const xml = (bytes, path) => new TextDecoder().decode(new Uint8Array(XLSX.CFB.find(XLSX.CFB.read(bytes, { type: 'array' }), '/' + path).content))

afterEach(() => vi.unstubAllGlobals())

describe('season template workbook roundtrip', () => {
  it('matches both header rows, the title and nine merges, and all sixteen numeric component columns', () => {
    const formats = ['ranking', 'elimination', 'team', 'mixed_doubles']
    const scores = ['50m', '30M', '18m', '10m'].flatMap((distance, d) => formats.map((format, f) => score(distance, format, (d * 4 + f + 1) / 10)))
    const { book, sheet, bytes } = readExport([{ ranking: 1, name: '张三', club: '甲', scores }])
    expect(book.SheetNames).toEqual(['Sheet1'])
    expect(sheet.A1.v).toBe('杭州弓箭俱乐部冠军联赛\n2026赛季第一站反曲弓积分排名')
    expect(['A2', 'B2', 'C2', 'D2', 'H2', 'L2', 'P2', 'T2'].map(key => sheet[key].v)).toEqual(['排名', '姓名', '俱乐部', '50M', '30M', '18M', '10M', '第一站积分'])
    expect(Array.from({ length: 16 }, (_, c) => sheet[String.fromCharCode(68 + c) + '3'].v)).toEqual(Array.from({ length: 4 }, () => ['排位赛', '淘汰赛', '团体赛', '混双赛']).flat())
    expect(sheet['!merges'].map(range => XLSX.utils.encode_range(range))).toEqual(['A1:T1', 'D2:G2', 'H2:K2', 'L2:O2', 'P2:S2', 'A2:A3', 'B2:B3', 'C2:C3', 'T2:T3'])
    for (let column = 3; column < 19; column += 1) {
      expect(sheet[String.fromCharCode(65 + column) + '4']).toMatchObject({ t: 'n', v: (column - 2) / 10, z: '0.0' })
    }
    expect(sheet.T4).toMatchObject({ t: 'n', v: 13.6, z: '0.0', w: '13.6' })
    expect(xml(bytes, 'xl/worksheets/sheet1.xml')).not.toContain('<f>')
    expect(sheet['!ref']).toBe('A1:T4')
  })

  it('retains template fonts, colors, borders, alignment, heights and alternating fills beyond eighteen athletes', () => {
    const { bytes, sheet } = readExport(Array.from({ length: 25 }, (_, i) => ({ ranking: i + 1, name: '选手' + i, scores: [score('30m', 'team', 2)] })))
    expect(sheet['!ref']).toBe('A1:T28')
    expect(sheet.A28.v).toBe(25)
    expect(sheet.T28).toMatchObject({ t: 'n', v: 2, w: '2.0' })
    const styles = new DOMParser().parseFromString(xml(bytes, 'xl/styles.xml'), 'application/xml')
    const originalStyles = new DOMParser().parseFromString(xml(template, 'xl/styles.xml'), 'application/xml')
    for (const tag of ['fills', 'borders', 'cellStyleXfs']) {
      expect(styles.getElementsByTagName(tag)[0].outerHTML).toBe(originalStyles.getElementsByTagName(tag)[0].outerHTML)
    }
    const fonts = styles.getElementsByTagName('fonts')[0].children
    const originalFonts = originalStyles.getElementsByTagName('fonts')[0].children
    expect(fonts.length).toBe(originalFonts.length + 1)
    Array.from(originalFonts).forEach((font, index) => expect(fonts[index].outerHTML).toBe(font.outerHTML))
    expect(fonts[fonts.length - 1].getElementsByTagName('sz')[0].getAttribute('val')).toBe('16')
    const xfs = styles.getElementsByTagName('cellXfs')[0].children
    expect(xfs[6].getElementsByTagName('alignment')[0].getAttribute('wrapText')).toBe('1')
    expect(xfs[4].getAttribute('fontId')).toBe('1')
    expect(xfs[4].getAttribute('borderId')).toBe('1')
    expect(xfs[4].getAttribute('fillId')).toBe('0')
    expect(xfs[5].getAttribute('fillId')).toBe('3')
    expect(xfs[4].getElementsByTagName('alignment')[0].getAttribute('horizontal')).toBe('center')
    const data = new DOMParser().parseFromString(xml(bytes, 'xl/worksheets/sheet1.xml'), 'application/xml')
    expect(data.querySelector('c[r="D27"]').getAttribute('s')).toBe('5')
    expect(data.querySelector('c[r="D28"]').getAttribute('s')).toBe('4')
    expect(data.querySelector('row[r="28"]').getAttribute('ht')).toBe('15.75')
    expect(data.querySelector('row[r="1"]').getAttribute('ht')).toBe('52.5')
    expect(data.querySelector('c[r="A1"]').getAttribute('s')).toBe('6')
  })

  it('aggregates duplicate cells after rounding, excludes other seasons and keeps missing cells blank', () => {
    const { sheet } = readExport([{ ranking: 3, name: '=1+1 & <甲>', scores: [
      score('30m', 'ranking', 0.29), score('30M', 'ranking', 0.29),
      score('18m', 'elimination', 0.29), score('10m', 'team', 0),
      score('50m', 'mixed_doubles', 100, 2),
    ] }])
    expect(sheet.B4).toMatchObject({ t: 's', v: '=1+1 & <甲>' })
    expect(sheet.B4.f).toBeUndefined()
    expect(sheet.C4?.v).toBeUndefined()
    expect(sheet.H4).toMatchObject({ t: 'n', v: 0.6, z: '0.0' })
    expect(sheet.M4.v).toBe(0.3)
    expect(sheet.R4.v).toBe(0)
    expect(sheet.D4?.v).toBeUndefined()
    expect(sheet.T4).toMatchObject({ t: 'n', v: 0.9, w: '0.9' })
  })

  it('handles no athletes and empty scores without retaining template sample ranks', () => {
    const empty = readExport([]).sheet
    expect(empty['!ref']).toBe('A1:T3')
    expect(empty.A4).toBeUndefined()
    const blank = readExport([{ ranking: 1, name: '无成绩', scores: [] }, { ranking: 2, name: '无明细' }]).sheet
    expect(blank.T4).toMatchObject({ t: 'n', v: 0, w: '0.0' })
    expect(blank.T5.v).toBe(0)
    expect(blank.D4?.v).toBeUndefined()
  })

  it('rejects unsupported projects instead of silently losing part of the total', () => {
    expect(() => readExport([{ ranking: 1, scores: [score('70m', 'ranking', 1)] }])).toThrow('模板不支持')
    expect(() => readExport([{ ranking: 1, scores: [score('30m', 'unknown', 1)] }])).toThrow('模板不支持')
  })

  it('matches the pictured summer title and station total', () => {
    const bytes = buildSeasonWorkbook(XLSX, template, { ...options([]), eventLabel: '夏季赛' })
    const sheet = XLSX.read(bytes, { type: 'array' }).Sheets.Sheet1
    expect(sheet.A1.v).toBe('杭州弓箭俱乐部冠军联赛\n2026赛季第二站反曲弓积分排名')
    expect(sheet.T2.v).toBe('第二站积分')
  })

  it('uses a dynamic event title', () => {
    const bytes = buildSeasonWorkbook(XLSX, template, { ...options([]), eventLabel: '冬季赛 & 决赛' })
    expect(XLSX.read(bytes, { type: 'array' }).Sheets.Sheet1.T2.v).toBe('冬季赛 & 决赛积分')
  })
})

describe('decimal tenths', () => {
  it.each([[0.29, 3], [0.25, 3], [0.24, 2], [0.18, 2], [0.05, 1], [0.3, 3], [4.1, 41], [1.15, 12], [2.55, 26], ['1.999', 20], [-1.25, -13], [-1.99, -20], ['2.9e-1', 3], ['5e-2', 1], ['1e2', 1000], [1e-7, 0], [0, 0], [null, 0]])('rounds %s half up to %s tenths', (value, expected) => {
    expect(pointTenths(value)).toBe(expected)
  })
  it('sums rounded decimal components instead of rounding their raw total', () => {
    expect(sumPointTenths([{ points: 0.29 }, { points: 0.29 }, { points: 0.29 }])).toBe(9)
    expect(sumPointTenths([{ points: 0.24 }, { points: 0.24 }, { points: 0.24 }])).toBe(6)
    expect(sumPointTenths([{ points: 0.18 }, { points: 0.18 }, { points: 0.18 }])).toBe(6)
    expect(sumPointTenths([{ points: 0.3 }, { points: 0.6 }])).toBe(9)
    expect(() => pointTenths(Infinity)).toThrow('积分数据无效')
  })
})

describe('browser download', () => {
  it('downloads the complete ZIP with the requested filename and revokes its URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => template })))
    const create = vi.fn(() => 'blob:season-export')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('春季赛.xlsx')
      expect(this.href).toBe('blob:season-export')
    })
    await exportSeasonPoints(XLSX, { ...options([]), filename: '春季赛.xlsx' })
    expect(create.mock.calls[0][0].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:season-export')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })

  it('reports failed template loads without starting a download', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    await expect(exportSeasonPoints(XLSX, options([]))).rejects.toThrow('模板加载失败')
  })
})
