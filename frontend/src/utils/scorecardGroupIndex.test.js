import { describe, expect, it } from 'vitest'
import { RULE_BOW_TYPES } from './scoringRules'
import { filterScorecardGroups, indexScorecardDivisions, sortScorecardGroups } from './scorecardGroupIndex'

const group = (key, overrides = {}) => ({ key, label: '光弓10米男子组', bowType: 'barebow', distance: '10m', genderGroup: 'men', ...overrides })
const keys = groups => groups.map(item => item.key)
const groups = [
  group('i-men', { label: '光弓10米男子组（青少年）' }),
  group('i-women', { label: '光弓10米女子组', format: 'individual', genderGroup: 'women' }),
  group('i-mixed', { label: '光弓10米组', genderGroup: 'mixed' }),
  group('i-sightless', { label: '无瞄18米组', bowType: 'sightless', distance: '18m', genderGroup: 'mixed' }),
  group('i-compound', { label: '复合弓50米女子组', bowType: 'compound', distance: '50m', genderGroup: 'women' }),
  group('i-recurve', { label: '反曲弓30米男子组', bowType: 'recurve', distance: '30m' }),
  group('i-traditional', { label: '传统弓10米男子组', bowType: 'traditional' }),
  group('i-longbow', { label: '美猎弓18米男子组', bowType: 'longbow', distance: '18m' }),
  group('t-men', { label: '光弓10米男子团体', format: 'team' }),
  group('x-mixed', { label: '光弓10米混双', format: 'mixed_team', genderGroup: 'mixed' }),
  group('t-mixed', { label: '光弓30米混合团体', format: 'team', distance: '30m', genderGroup: 'mixed' }),
  group('i-110', { label: '反曲弓110米男子组', bowType: 'recurve', distance: '110m' }),
]

describe('sortScorecardGroups', () => {
  it('orders each cohort by SABC, far-to-near distance, bow, and gender', () => {
    const genders = ['men', 'women', 'mixed']
    const distances = ['70m', '50m', '30m', '18m', '10m']
    const make = (format, division, genderGroup, bowType, distance) => group(
      [format, division, genderGroup, bowType, distance].join('/'), { label: division + '组', format, genderGroup, bowType, distance },
    )
    const grid = ['S', 'A', 'B', 'C'].flatMap(division => distances.flatMap(distance =>
      RULE_BOW_TYPES.flatMap(bow => genders.map(gender => [division, gender, bow, distance]))))
    const individual = grid.map(row => make('individual', ...row))
    const teams = grid.flatMap(row => ['team', 'mixed_team'].map(format => make(format, ...row)))
    const expected = [...individual, ...teams]
    const input = Object.freeze([...expected].reverse().map(Object.freeze))
    const result = sortScorecardGroups(input)
    expect(keys(result)).toEqual(keys(expected))
    expect(result).not.toBe(input)
    expect(keys(input)).toEqual(keys(expected).reverse())
    expect(result[0]).toBe(expected[0])
  })

  it('does not sort an entire team block before mixed-team distance or gender precedence', () => {
    const input = [
      group('team-women', { format: 'team', genderGroup: 'women' }),
      group('team-50', { format: 'team', distance: '50m' }),
      group('mixed-10', { format: 'mixed_team' }),
      group('team-10', { format: 'team' }),
      group('i-mixed-compound', { genderGroup: 'mixed', bowType: 'compound', distance: '70m' }),
    ]
    expect(keys(sortScorecardGroups(input))).toEqual(['i-mixed-compound', 'team-50', 'team-10', 'mixed-10', 'team-women'])
  })

  it('uses workbook division for matching entries and dictionary for unlabeled pairs; unknowns stay last', () => {
    const input = [
      group('unknown', { label: '70米复合弓团体', bowType: 'compound', distance: '70m', format: 'team' }),
      group('b-team', { label: '反曲弓50米团体', bowType: 'recurve', distance: '50m', format: 'team' }),
      group('b-label', { label: 'Ｂ 组50米反曲弓', bowType: 'recurve', distance: '50m' }),
      group('a-mixed', { label: '反曲弓30米混双', bowType: 'recurve', distance: '30m', format: 'mixed_team' }),
    ]
    const dictionary = [{ bow_type: 'recurve', distance: '50m', group_code: 'S' }, { bow_type: 'recurve', distance: '30m', group_code: 'A' }]
    const divisions = indexScorecardDivisions(input, dictionary)
    const sorted = sortScorecardGroups(input, divisions)
    expect(keys(sorted)).toEqual(['b-label', 'a-mixed', 'b-team', 'unknown'])
    expect(keys(filterScorecardGroups(sorted, 'Ｂ组50米团体', divisions))).toEqual(['b-team'])
    expect(keys(sortScorecardGroups(input))).toEqual(['b-label', 'b-team', 'unknown', 'a-mixed'])
  })

  it('treats omitted format as individual and preserves exact ties in supplied order', () => {
    const input = [group('z-first'), group('a-second', { format: 'individual' }), group('m-third')]
    expect(keys(sortScorecardGroups(input))).toEqual(['z-first', 'a-second', 'm-third'])
  })

  it('sorts distances numerically and puts unrecognized distances after numeric values stably', () => {
    const input = ['unknown', '100m', '30m', '１０米', '18m', 'other'].map(distance => group(distance, { distance }))
    expect(keys(sortScorecardGroups(input))).toEqual(['100m', '30m', '18m', '１０米', 'unknown', 'other'])
  })

  it('uses inferred genders for labels with no explicit metadata, with unmarked bow groups mixed', () => {
    const input = [group('mixed', { label: '反曲弓组', genderGroup: undefined }), group('women', { label: '反曲弓女子组', genderGroup: undefined }), group('men', { label: '反曲弓男子组', genderGroup: undefined })]
    expect(keys(sortScorecardGroups(input))).toEqual(['men', 'women', 'mixed'])
    expect(sortScorecardGroups([])).toEqual([])
  })
})

describe('filterScorecardGroups', () => {
  it.each([
    ['光弓', ['i-men', 'i-women', 'i-mixed', 't-men', 'x-mixed', 't-mixed']],
    ['无瞄', ['i-sightless']], ['无瞄弓', ['i-sightless']], ['sightless', ['i-sightless']],
    ['传统', ['i-traditional']], ['传统弓', ['i-traditional']], ['traditional', ['i-traditional']],
    ['美猎', ['i-longbow']], ['美猎弓', ['i-longbow']], ['longbow', ['i-longbow']],
    ['反曲', ['i-recurve', 'i-110']], ['反曲弓', ['i-recurve', 'i-110']], ['recurve', ['i-recurve', 'i-110']],
    ['复合', ['i-compound']], ['复合弓', ['i-compound']], ['compound', ['i-compound']],
    ['青少年', ['i-men']],
  ])('finds label, Chinese bow aliases or stable code %s', (query, expected) => {
    expect(keys(filterScorecardGroups(groups, query))).toEqual(expected)
  })

  it.each([
    ['男', ['i-men', 'i-recurve', 'i-traditional', 'i-longbow', 't-men', 'i-110']],
    ['男子组', ['i-men', 'i-recurve', 'i-traditional', 'i-longbow', 't-men', 'i-110']],
    ['men', ['i-men', 'i-recurve', 'i-traditional', 'i-longbow', 't-men', 'i-110']],
    ['women', ['i-women', 'i-compound']], ['女子', ['i-women', 'i-compound']], ['女组', ['i-women', 'i-compound']],
    ['混合', ['i-mixed', 'i-sightless', 'x-mixed', 't-mixed']],
    ['mixed', ['i-mixed', 'i-sightless', 'x-mixed', 't-mixed']],
    ['混合组', ['i-mixed', 'i-sightless', 'x-mixed', 't-mixed']],
  ])('finds gender %s without treating men as a substring of women', (query, expected) => {
    expect(keys(filterScorecardGroups(groups, query))).toEqual(expected)
  })

  it.each([
    ['个人', ['i-men', 'i-women', 'i-mixed', 'i-sightless', 'i-compound', 'i-recurve', 'i-traditional', 'i-longbow', 'i-110']],
    ['个人赛', ['i-men', 'i-women', 'i-mixed', 'i-sightless', 'i-compound', 'i-recurve', 'i-traditional', 'i-longbow', 'i-110']],
    ['团体', ['t-men', 't-mixed']], ['team', ['t-men', 't-mixed']],
    ['混双', ['x-mixed']], ['mixed_team', ['x-mixed']], ['mixed_doubles', ['x-mixed']], ['mixed doubles', ['x-mixed']],
  ])('finds format %s without substring collisions between team and mixed_team', (query, expected) => {
    expect(keys(filterScorecardGroups(groups, query))).toEqual(expected)
  })

  it.each([
    ['10米', ['i-men', 'i-women', 'i-mixed', 'i-traditional', 't-men', 'x-mixed']],
    ['10m', ['i-men', 'i-women', 'i-mixed', 'i-traditional', 't-men', 'x-mixed']],
    ['１０Ｍ', ['i-men', 'i-women', 'i-mixed', 'i-traditional', 't-men', 'x-mixed']],
    ['18 米', ['i-sightless', 'i-longbow']], ['110m', ['i-110']], ['1m', []],
  ])('matches numeric distance %s exactly, rather than a substring of 110m', (query, expected) => {
    expect(keys(filterScorecardGroups(groups, query))).toEqual(expected)
  })

  it.each([
    ['光弓 男子 10米', ['i-men', 't-men']],
    ['光弓10米男子组', ['i-men', 't-men']],
    ['个人光弓10m男', ['i-men']],
    ['团体光弓１０米男', ['t-men']],
    ['　光弓　１０Ｍ　男子　团体　', ['t-men']],
    ['女子barebow10m', ['i-women']],
    ['BAREBOW10MWOMEN', ['i-women']],
    ['barebow10men', ['i-men', 't-men']],
    ['无瞄１８米混合组', ['i-sightless']],
    ['混双光弓10m混合组', ['x-mixed']],
    ['mixed_team光弓10米', ['x-mixed']],
    ['光弓混合团体10m', ['x-mixed']],
    ['光弓１０ m 青少年', ['i-men']],
    ['男子·光弓·１０米·青少年', ['i-men']],
    ['光弓组10米个人', ['i-men', 'i-women', 'i-mixed']],
    ['复合50米女子个人', ['i-compound']],
  ])('supports normalized multi-term and compact combinations %s', (query, expected) => {
    expect(keys(filterScorecardGroups(groups, query))).toEqual(expected)
  })

  it.each(['完全不存在', '光弓 女 男', '光弓 反曲', '10米 18米', '个人 团体', '团体 混双', '不存在光弓', '.*', '---'])('returns no result for unmatched or contradictory query %s', query => {
    expect(filterScorecardGroups(groups, query)).toEqual([])
  })

  it.each(['', ' 　\t\n', null, undefined])('returns a new array in original order when query %j is empty', query => {
    const result = filterScorecardGroups(groups, query)
    expect(result).toEqual(groups)
    expect(result).not.toBe(groups)
    expect(result[0]).toBe(groups[0])
  })

  it('filters without sorting, mutating groups or altering pending artifact references', () => {
    const pdf = new Blob(['pdf'])
    const input = Object.freeze([group('later', { distance: '30m', pdf }), group('earlier', { distance: '10m', pdf })].map(Object.freeze))
    const result = filterScorecardGroups(input, '光弓')
    expect(keys(result)).toEqual(['later', 'earlier'])
    expect(result[0].pdf).toBe(pdf)
    expect(result[0]).toBe(input[0])
  })

  it('finds mixed gender even when the label does not state mixed, using explicit metadata or inference', () => {
    const input = [group('explicit', { label: '光弓组', genderGroup: 'mixed' }), group('inferred', { label: '反曲弓组', bowType: 'recurve', genderGroup: undefined }), group('men')]
    expect(keys(filterScorecardGroups(input, '混合组'))).toEqual(['explicit', 'inferred'])
  })

  it('treats explicit gender/format metadata as authoritative over incidental label text', () => {
    const item = group('authoritative', { label: '光弓男子团体组', genderGroup: 'women', format: 'individual' })
    expect(filterScorecardGroups([item], '男')).toEqual([])
    expect(filterScorecardGroups([item], '团体')).toEqual([])
    expect(filterScorecardGroups([item], '女子个人光弓10米')).toEqual([item])
  })
})
