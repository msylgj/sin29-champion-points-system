import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx/xlsx.mjs'
import { parseTeamScorecardGroups } from './teamScorecardInput'

// All roster identities below are fictional, generated in memory.
const sheet = () => ({ rows: [], merges: [] })
const put = (target, r, c, value) => { target.rows[r] ||= []; target.rows[r][c] = value }
const makeTeam = (serial = 1, names = ['选手甲*', '选手乙', '选手丙'], clubs = ['示例队', '示例队', '示例队']) => ({ serial, names, clubs })
const block = (target, row, column, label, teams, { serialMerge = true, nameMerge = true, repeatSerial = false } = {}) => {
  const size = /混双|混合团体/.test(label) ? 2 : 3
  put(target, row, column, label)
  target.merges.push({ s: { r: row, c: column }, e: { r: row, c: column + 2 } })
  ;['序号', '团体参赛队', '参赛选手'].forEach((value, index) => put(target, row + 1, column + index, value))
  for (const [index, team] of teams.entries()) {
    const start = row + 2 + index * size
    put(target, start, column, team.serial)
    for (let offset = 0; offset < size; offset += 1) {
      put(target, start + offset, column + 2, team.names[offset] || '')
      if (!nameMerge || offset === 0) put(target, start + offset, column + 1, team.clubs[offset] || '')
      if (repeatSerial) put(target, start + offset, column, team.serial)
    }
    if (serialMerge) target.merges.push({ s: { r: start, c: column }, e: { r: start + size - 1, c: column } })
    if (nameMerge) target.merges.push({ s: { r: start, c: column + 1 }, e: { r: start + size - 1, c: column + 1 } })
  }
  return row + 2 + teams.length * size
}
const write = (sheets, bookType = 'xlsx') => {
  const book = XLSX.utils.book_new()
  for (const [index, item] of sheets.entries()) {
    const worksheet = XLSX.utils.aoa_to_sheet(item.rows)
    worksheet['!merges'] = item.merges
    if (item.range) worksheet['!ref'] = item.range
    XLSX.utils.book_append_sheet(book, worksheet, item.name || '虚构工作表' + index)
  }
  return XLSX.write(book, { type: 'array', bookType, compression: true })
}
const parse = (...sheets) => parseTeamScorecardGroups(write(sheets))
const one = (label = '反曲弓30米团体', teams = [makeTeam()], options) => {
  const target = sheet(); block(target, 0, 0, label, teams, options); return target
}
const canonicalTeam = team => JSON.stringify(team.names.map((name, index) => JSON.stringify([team.clubs[index], name])).sort())
const fingerprint = teams => 'sha256:' + createHash('sha256').update(JSON.stringify(teams.map(canonicalTeam).sort())).digest('hex')

describe('team workbook horizontal and vertical regions', () => {
  it('handles spaced and immediately adjacent three-column regions and independent vertical cutovers', () => {
    const saturday = sheet()
    block(saturday, 0, 0, '反曲弓30米团体', [makeTeam(7), makeTeam(2)])
    block(saturday, 0, 4, '无瞄弓18米团体', [makeTeam()])
    block(saturday, 8, 0, '反曲弓30米混双', [makeTeam(4, ['混甲', '混乙'], ['示例队', '示例队'])])
    const sunday = sheet()
    block(sunday, 0, 0, '传统弓30米团体', [makeTeam()])
    block(sunday, 0, 3, '光弓30米团体', [makeTeam()])
    block(sunday, 0, 6, '无瞄10米团体', [makeTeam(), makeTeam(99)])
    const groups = parse(saturday, sunday)
    expect(groups.map(({ format, bowType, distance, participantCount }) => [format, bowType, distance, participantCount])).toEqual([
      ['team', 'recurve', '30m', 2], ['team', 'sightless', '18m', 1], ['mixed_team', 'recurve', '30m', 1],
      ['team', 'traditional', '30m', 1], ['team', 'barebow', '30m', 1], ['team', 'sightless', '10m', 2],
    ])
    expect(groups.every(group => group.genderGroup === 'mixed')).toBe(true)
    expect(groups.every(group => Object.keys(group).sort().join(',') === 'bowType,distance,fingerprint,format,genderGroup,label,participantCount')).toBe(true)
  })

  it('counts teams by numbered roster boundary, not unique team/club name or maximum serial rank', () => {
    const target = one('反曲弓30米团体', [makeTeam(99), makeTeam(3, ['别甲', '别乙', '别丙'])])
    expect(parse(target)[0].participantCount).toBe(2)
    const other = one('反曲弓30米团体', [makeTeam(2), makeTeam(700, ['别甲', '别乙', '别丙'])])
    expect(parse(other)[0].fingerprint).toBe(parse(target)[0].fingerprint)
  })

  it('supports vertically merged team names, repeated same names and cross-club teams without splitting them', () => {
    const team = makeTeam(1, ['跨队甲', '跨队乙', '跨队丙'], ['俱乐部甲', '俱乐部乙', '俱乐部丙'])
    expect(parse(one('反曲弓30米团体', [team], { nameMerge: false }))[0]).toMatchObject({ participantCount: 1, fingerprint: fingerprint([team]) })
    const merged = parse(one())[0]
    const repeated = parse(one('反曲弓30米团体', [makeTeam()], { nameMerge: false }))[0]
    expect(merged.fingerprint).toBe(repeated.fingerprint)
    const firstOnly = one('反曲弓30米团体', [makeTeam()], { nameMerge: false })
    firstOnly.rows[3][1] = ''; firstOnly.rows[4][1] = ''
    expect(parse(firstOnly)[0].fingerprint).toBe(merged.fingerprint)
  })

  it('does not mistake a legitimate team name mentioning the event for another section heading', () => {
    const target = one('反曲弓30米团体', [makeTeam(1, undefined, ['反曲弓30米团体一队', '反曲弓30米团体一队', '反曲弓30米团体一队'])])
    expect(parse(target)[0].participantCount).toBe(1)
  })

  it('supports explicitly repeated same serial per person without counting each person as a team', () => {
    expect(parse(one('反曲弓30米团体', [makeTeam()], { serialMerge: false, repeatSerial: true }))[0].participantCount).toBe(1)
  })

  it('merges repeated same metadata across sections/days while retaining each actual numbered team', () => {
    const target = one()
    block(target, 8, 0, '30米反曲弓团体', [makeTeam(1)])
    const groups = parse(target, one())
    expect(groups).toHaveLength(1)
    expect(groups[0].participantCount).toBe(3)
    expect(groups[0].fingerprint).toBe(fingerprint([makeTeam(), makeTeam(), makeTeam()]))
  })

  it('ignores unnumbered residual team names and fully empty numbered placeholders, but not actual teams', () => {
    const target = one('反曲弓30米团体', [makeTeam(), makeTeam(2, ['', '', ''])])
    put(target, 10, 1, '残留占位队名'); put(target, 10, 2, '残留内容')
    expect(parse(target)[0].participantCount).toBe(1)
    expect(parse(one('反曲弓30米团体', [makeTeam(1, ['', '', ''])]))).toEqual([])
  })

  it('does not swallow a valid numbered team immediately after an empty one-row placeholder', () => {
    const target = one('反曲弓30米团体', [makeTeam()], { serialMerge: false, nameMerge: false })
    target.rows.splice(2, 0, [1, '空模板', ''])
    target.rows[3][0] = 2
    expect(parse(target)[0].participantCount).toBe(1)
  })

  it.each([
    ['复合弓70米男子团体', 'team', 'compound', '70m', 'men'],
    ['美猎弓50米女子团体', 'team', 'longbow', '50m', 'women'],
    ['10米无瞄混双', 'mixed_team', 'sightless', '10m', 'mixed'],
  ])('extracts metadata from %s', (label, format, bowType, distance, genderGroup) => {
    const size = format === 'team' ? 3 : 2
    const groups = parse(one(label, [makeTeam(1, ['甲', '乙', '丙'].slice(0, size), ['队', '队', '队'].slice(0, size))]))
    expect(groups[0]).toMatchObject({ format, bowType, distance, genderGroup, participantCount: 1 })
  })
})

describe('team fingerprints contain roster composition but no ordinal or personal data', () => {
  it('is stable when teams/members are reordered and serials change, but not when people move between teams', () => {
    const first = makeTeam(1, ['甲', '乙', '丙'], ['队一', '队一', '队一'])
    const second = makeTeam(2, ['丁', '戊', '己'], ['队二', '队二', '队二'])
    const original = parse(one('反曲弓30米团体', [first, second]))[0]
    const reversed = parse(one('反曲弓30米团体', [{ ...second, serial: 99, names: [...second.names].reverse() }, { ...first, serial: 80, names: [...first.names].reverse() }]))[0]
    expect(reversed.fingerprint).toBe(original.fingerprint)
    expect(original.fingerprint).toBe(fingerprint([first, second]))
    expect(original.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(JSON.stringify(original)).not.toContain('队一')
    const swapped = [{ ...first, names: ['丁', '乙', '丙'] }, { ...second, names: ['甲', '戊', '己'] }]
    expect(parse(one('反曲弓30米团体', swapped))[0].fingerprint).not.toBe(original.fingerprint)
    expect(parse(one('反曲弓30米团体', [{ ...first, clubs: ['另一队', '另一队', '另一队'] }, second]))[0].fingerprint).not.toBe(original.fingerprint)
  })

  it('preserves literal formula-looking and starred names as content without executing formulas', () => {
    const team = makeTeam(1, ['=名字*', '+测试名', '@第三位'], ['虚构队', '虚构队', '虚构队'])
    expect(parse(one('反曲弓30米团体', [team]))[0].fingerprint).toBe(fingerprint([team]))
  })
})

describe('team workbook recognition and damaged-format errors', () => {
  it('returns [] for unrelated/individual or empty sheets without requiring team metadata', () => {
    const personal = sheet(); personal.rows = [['序号', '俱乐部', '姓名'], [1, '示例社团', '虚构个人']]
    const stations = sheet(); stations.rows = [['C组10米反曲弓组'], ['靶位号', '俱乐部', '姓名'], ['1A', '示例', '个人']]
    expect(parse(personal, stations, sheet())).toEqual([])
  })

  it.each(['未知弓30米团体', '反曲弓20米团体', '反曲弓1018米团体', '反曲弓30米团体混双', '反曲弓30米男子女子团体'])('does not silently ignore recognized malformed group %s', label => {
    expect(() => parse(one(label))).toThrow('无法识别队伍分组')
  })

  it('reports missing or damaged team headers and orphan team roster headers', () => {
    const missing = one(); missing.rows[1][1] = '不明字段'
    expect(() => parse(missing)).toThrow('表头应为')
    const orphan = sheet(); orphan.rows = [['序号', '团体参赛队', '参赛选手']]
    expect(() => parse(orphan)).toThrow('缺少可识别')
    const empty = sheet(); empty.rows = [['反曲弓30米团体']]
    expect(() => parse(empty)).toThrow('缺少表头')
  })

  it('reports partial 3-person/2-person numbered rosters, early new serials and missing team identity', () => {
    expect(() => parse(one('反曲弓30米团体', [makeTeam(1, ['甲', '乙', ''])]))).toThrow('必须填足3名')
    expect(() => parse(one('反曲弓30米混双', [makeTeam(1, ['甲', ''])]))).toThrow('必须填足2名')
    const early = one('反曲弓30米团体', [makeTeam()], { serialMerge: false }); early.rows[3][0] = 2
    expect(() => parse(early)).toThrow('必须填足3名')
    expect(() => parse(one('反曲弓30米团体', [makeTeam(1, undefined, ['', '', ''])]))).toThrow('缺少队名')
  })

  it.each([0, -1, 1.5, 'rank1'])('rejects invalid populated team serial %s', serial => {
    expect(() => parse(one('反曲弓30米团体', [makeTeam(serial)]))).toThrow('正整数')
  })

  it('reports player-name merges, wrong-size serial merges, formulas, error values and excessive text', () => {
    const merged = one(); merged.merges.push({ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } })
    expect(() => parse(merged)).toThrow('姓名不能合并')
    const wrong = one(); wrong.merges[1].e.r = 3
    expect(() => parse(wrong)).toThrow('序号合并范围')
    const formula = one(); formula.rows[2][2] = { t: 'n', v: 2, f: '1+1' }
    expect(() => parse(formula)).toThrow('含公式')
    const bad = one(); bad.rows[2][2] = { t: 'e', v: 0x07 }
    expect(() => parse(bad)).toThrow('错误值')
    expect(() => parse(one('反曲弓30米团体', [makeTeam(1, ['字'.repeat(121), '乙', '丙'])]))).toThrow('120个字符')
  })

  it('rejects CSV disguised as Excel and protects file/sheet ranges while leaving typed input untouched', () => {
    expect(() => parseTeamScorecardGroups(new TextEncoder().encode('反曲弓30米团体\n序号,团体参赛队,参赛选手\n1,队,甲'))).toThrow('不支持CSV')
    expect(() => parseTeamScorecardGroups(new Uint8Array(10485761))).toThrow('10MiB')
    expect(() => parseTeamScorecardGroups(new Uint8Array())).toThrow('为空')
    const huge = one(); huge.range = 'A1:C5001'
    expect(() => parse(huge)).toThrow('范围过大')
    const source = new Uint8Array(write([one()]))
    const padded = new Uint8Array(source.length + 8); padded.set(source, 4)
    const before = padded.slice()
    expect(parseTeamScorecardGroups(padded.subarray(4, -4))[0].participantCount).toBe(1)
    expect(padded).toEqual(before)
    expect(parseTeamScorecardGroups(write([one()], 'biff8'))[0].participantCount).toBe(1)
  })
})
