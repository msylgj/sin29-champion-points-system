import { describe, expect, it } from 'vitest'
import { buildCoverageRows } from './wizardCoverage'

const dictionaries = () => ({
  competitionGroups: [{ bow_type: 'recurve', distance: '30m', group_code: 'A' }, { bow_type: 'compound', distance: '50m', group_code: 'A' }],
  bowTypes: [{ code: 'recurve', name: '反曲弓' }, { code: 'compound', name: '复合弓' }],
  competitionFormats: [{ code: 'ranking' }, { code: 'elimination' }, { code: 'mixed_doubles' }, { code: 'team' }],
})
const find = (rows, bow, distance, format = '', gender = '') => rows.find(row => row.key === JSON.stringify([bow, distance, format, gender]))

describe('saved wizard coverage matrix', () => {
  it('counts registrations by competition bow and distance, not points bow or gender', () => {
    const data = dictionaries()
    data.competitionGroups.push({ bow_type: 'recurve', distance: '30m', group_code: 'B' })
    const rows = buildCoverageRows('registrations', [
      { competition_bow_type: 'recurve', points_bow_type: 'compound', distance: '30m', competition_gender_group: 'men' },
      { competition_bow_type: 'recurve', points_bow_type: 'compound', distance: '30m', competition_gender_group: 'women' },
    ], data)
    expect(rows).toHaveLength(2)
    expect(find(rows, 'recurve', '30m')).toMatchObject({ count: 2, covered: true })
    expect(find(rows, 'compound', '50m')).toMatchObject({ count: 0, covered: false })
    expect(find(rows, 'compound', '30m')).toBeUndefined()
  })

  it('enumerates exact score format/gender combinations; mixed doubles only assumes mixed', () => {
    const rows = buildCoverageRows('scores', [
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men' },
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men' },
      { bow_type: 'recurve', distance: '30m', format: 'mixed_doubles', gender_group: 'mixed' },
    ], dictionaries())
    expect(rows).toHaveLength(19)
    expect(find(rows, 'recurve', '30m', 'ranking', 'men').count).toBe(2)
    expect(find(rows, 'recurve', '30m', 'ranking', 'women').covered).toBe(false)
    expect(find(rows, 'recurve', '30m', 'elimination', 'men').covered).toBe(false)
    expect(find(rows, 'recurve', '30m', 'mixed_doubles', 'mixed').covered).toBe(true)
    expect(find(rows, 'recurve', '30m', 'mixed_doubles', 'men')).toBeUndefined()
  })

  it('keeps mixed and ungrouped records when hiding men and women for the exact combination', () => {
    const data = dictionaries()
    data.competitionGroups.push({ bow_type: 'recurve', distance: '50m' })
    const records = [
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'mixed' },
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men' },
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'women' },
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: null },
    ]
    const original = structuredClone(records)
    const rows = buildCoverageRows('scores', records, data)
    expect(rows.filter(row => row.bowType === 'recurve' && row.distance === '30m' && row.format === 'ranking'))
      .toEqual([
        expect.objectContaining({ genderGroup: 'mixed', covered: true, count: 1 }),
        expect.objectContaining({ genderGroup: '', covered: true, count: 1 }),
      ])
    expect(find(rows, 'recurve', '50m', 'ranking', 'men')).toBeDefined()
    expect(find(rows, 'recurve', '30m', 'elimination', 'women')).toBeDefined()
    expect(find(rows, 'compound', '50m', 'ranking', 'men')).toBeDefined()
    expect(records).toEqual(original)
  })

  it.each([['men'], ['women']])('hides empty mixed when %s has scores, without hiding the other separate group', gender => {
    const records = [{ bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: gender }]
    const rows = buildCoverageRows('scores', records, dictionaries())
    expect(find(rows, 'recurve', '30m', 'ranking', 'mixed')).toBeUndefined()
    expect(find(rows, 'recurve', '30m', 'ranking', gender)).toMatchObject({ covered: true, count: 1 })
    expect(find(rows, 'recurve', '30m', 'ranking', gender === 'men' ? 'women' : 'men')).toMatchObject({ covered: false })
    expect(find(rows, 'recurve', '30m', 'elimination', 'mixed')).toMatchObject({ covered: false })
    expect(find(rows, 'compound', '50m', 'ranking', 'mixed')).toMatchObject({ covered: false })
  })

  const bowCases = [
    [[], ['sightless', 'barebow', 'longbow', 'traditional']],
    [['barebow'], ['barebow', 'longbow', 'traditional']],
    [['longbow'], ['barebow', 'longbow', 'traditional']],
    [['traditional'], ['barebow', 'longbow', 'traditional']],
    [['sightless'], ['sightless']],
    [['sightless', 'barebow', 'longbow'], ['sightless', 'barebow', 'longbow']],
    [['barebow', 'longbow', 'traditional'], ['barebow', 'longbow', 'traditional']],
    [['sightless', 'barebow', 'longbow', 'traditional'], ['sightless', 'barebow', 'longbow', 'traditional']],
  ]
  const scoreFormats = ['ranking', 'elimination', 'team', 'mixed_doubles']
  const scoreBowCases = scoreFormats.flatMap(format => bowCases.map(([saved, expected]) => [format, saved, expected]))
  it.each(scoreBowCases)('selects visible bow types in %s for saved scores %j', (format, saved, expected) => {
    const affected = ['sightless', 'barebow', 'longbow', 'traditional']
    const data = dictionaries()
    for (const bow_type of affected) {
      for (const distance of ['30m', '50m']) data.competitionGroups.push({ bow_type, distance })
    }
    const records = saved.map((bow_type, i) => ({
      bow_type, distance: '30m', format, gender_group: format === 'mixed_doubles' ? 'mixed' : i % 2 ? 'women' : 'men',
    }))
    const original = structuredClone(records)
    const rows = buildCoverageRows('scores', records, data)
    const visible = (distance, kind) => new Set(rows.filter(row => row.distance === distance && row.format === kind).map(row => row.bowType))
    expect(visible('30m', format)).toEqual(new Set(['recurve', ...expected]))
    for (const bow of saved) expect(rows.some(row => row.bowType === bow && row.distance === '30m' && row.format === format && row.covered)).toBe(true)
    for (const otherFormat of scoreFormats.filter(value => value !== format)) {
      expect(visible('30m', otherFormat)).toEqual(new Set(['recurve', ...affected]))
    }
    expect(visible('50m', format)).toEqual(new Set(['compound', ...affected]))
    expect(records).toEqual(original)
  })

  it('does not hide bows in registration coverage', () => {
    const data = dictionaries()
    data.competitionGroups.push({ bow_type: 'barebow', distance: '30m' })
    const rows = buildCoverageRows('registrations', [{ competition_bow_type: 'sightless', distance: '30m' }], data)
    expect(find(rows, 'sightless', '30m')).toMatchObject({ covered: true })
    expect(find(rows, 'barebow', '30m')).toMatchObject({ covered: false })
  })

  it('preserves saved blank and nonstandard mixed-double groups without treating them as mixed', () => {
    const rows = buildCoverageRows('scores', [
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: null },
      { bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: '' },
      { bow_type: 'recurve', distance: '30m', format: 'mixed_doubles', gender_group: 'men' },
    ], dictionaries())
    expect(find(rows, 'recurve', '30m', 'ranking', '')).toMatchObject({ count: 2 })
    expect(find(rows, 'recurve', '30m', 'ranking', 'mixed').count).toBe(0)
    expect(find(rows, 'recurve', '30m', 'mixed_doubles', 'men')).toMatchObject({ count: 1 })
    expect(find(rows, 'recurve', '30m', 'mixed_doubles', 'mixed')).toBeUndefined()
  })

  it('includes saved pairs and formats outside current dictionaries without mutating inputs', () => {
    const data = dictionaries()
    const original = structuredClone(data)
    const records = [{ bow_type: 'legacy-bow', distance: '90m', format: 'legacy-format', gender_group: 'legacy-group' }]
    const rows = buildCoverageRows('scores', records, data)
    expect(find(rows, 'legacy-bow', '90m', 'legacy-format', 'legacy-group')).toMatchObject({ covered: true, count: 1 })
    expect(data).toEqual(original)
    expect(records).toEqual([{ bow_type: 'legacy-bow', distance: '90m', format: 'legacy-format', gender_group: 'legacy-group' }])
  })

  it('keeps empty coverage neutral and adds no cartesian bow/distance pairs', () => {
    const rows = buildCoverageRows('registrations', [], dictionaries())
    expect(rows).toHaveLength(2)
    expect(rows.every(row => !row.covered && row.count === 0)).toBe(true)
    expect(find(rows, 'recurve', '50m')).toBeUndefined()
    expect(buildCoverageRows('registrations', [], { competitionGroups: [] })).toEqual([])
  })

  it('uses safe canonical format defaults if there are no format dictionary rows', () => {
    const rows = buildCoverageRows('scores', [], { competitionGroups: [{ bow_type: 'recurve', distance: '30m' }] })
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map(row => row.format))).toEqual(new Set(['ranking', 'elimination', 'mixed_doubles', 'team']))
  })

  it('orders dictionary bows and distances without sorting the source data', () => {
    const data = dictionaries()
    data.competitionGroups.push({ bow_type: 'recurve', distance: '50m' })
    const rows = buildCoverageRows('registrations', [], data)
    expect(rows.map(row => [row.bowType, row.distance])).toEqual([['recurve', '50m'], ['recurve', '30m'], ['compound', '50m']])
    expect(() => buildCoverageRows('preview', [], data)).toThrow('不支持的核查类型')
  })
})
