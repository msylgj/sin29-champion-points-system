import { describe, expect, it } from 'vitest'

import {
  FIELD_MAPPINGS,
  SCORE_IMPORT_ALIASES,
  buildScoreUniqueKey,
  convertToCode,
  createValueToCodeMap,
  mapColumns,
  markInFileDuplicates,
  normalizeKeyPart,
  parseScoreImportData,
  recalculateDuplicateFlags,
} from './scoreImportParsing'

describe('score import parsing helpers', () => {
  const bowTypes = [
    { name: '光弓', code: 'barebow' },
    { name: '美猎弓', code: 'longbow' },
    { name: '传统弓', code: 'traditional' },
    { name: '反曲弓', code: 'recurve' },
    { name: '复合弓', code: 'compound' },
  ]
  const distances = [
    { name: '10米', code: '10m' },
    { name: '18米', code: '18m' },
    { name: '30米', code: '30m' },
    { name: '50米', code: '50m' },
    { name: '70米', code: '70m' },
  ]
  const formats = [
    { name: '排位赛', code: 'ranking' },
    { name: '淘汰赛', code: 'elimination' },
    { name: '混双赛', code: 'mixed_doubles' },
    { name: '团体赛', code: 'team' },
  ]

  it('supports fuzzy aliases for bow type, distance, and format', () => {
    const bowTypeMap = createValueToCodeMap(bowTypes, SCORE_IMPORT_ALIASES.bow_type)
    const distanceMap = createValueToCodeMap(distances, SCORE_IMPORT_ALIASES.distance)
    const formatMap = createValueToCodeMap(formats, SCORE_IMPORT_ALIASES.format)

    expect(convertToCode('传统', bowTypeMap)).toBe('traditional')
    expect(convertToCode('美猎', bowTypeMap)).toBe('longbow')
    expect(convertToCode('18', distanceMap)).toBe('18m')
    expect(convertToCode('18m', distanceMap)).toBe('18m')
    expect(convertToCode('18 米', distanceMap)).toBe('18m')
    expect(convertToCode('排位', formatMap)).toBe('ranking')
    expect(convertToCode('barebow', bowTypeMap)).toBe('barebow')
    expect(convertToCode('ranking', formatMap)).toBe('ranking')
  })

  it('provides the shared column and key helpers for score parsing', () => {
    expect(
      mapColumns(['姓名', '弓种', '距离', '赛制', '排名'], FIELD_MAPPINGS)
    ).toEqual({
      name: 0,
      bow_type: 1,
      distance: 2,
      format: 3,
      rank: 4,
    })

    expect(normalizeKeyPart(' 张三 ')).toBe('张三')
    expect(
      buildScoreUniqueKey({
        name: '张三',
        bow_type: 'traditional',
        distance: '18m',
        format: 'ranking',
      })
    ).toBe('张三|traditional|18m|ranking')
  })

  it('marks in-file duplicates for scores', () => {
    const scores = [
      { __duplicate: false, __duplicate_in_file: false, __duplicate_in_file_to_remove: false },
      { __duplicate: false, __duplicate_in_file: false, __duplicate_in_file_to_remove: false },
      { __duplicate: false, __duplicate_in_file: false, __duplicate_in_file_to_remove: false },
    ]
    const keyToIndexes = new Map([['dup', [0, 2]]])

    markInFileDuplicates(scores, keyToIndexes)

    expect(scores[0]).toMatchObject({
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: false,
      __duplicate: false,
    })
    expect(scores[1]).toMatchObject({
      __duplicate_in_file: false,
      __duplicate_in_file_to_remove: false,
      __duplicate: false,
    })
    expect(scores[2]).toMatchObject({
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: true,
      __duplicate: true,
    })
  })

  it('parses imported rows end-to-end and returns a summary message', () => {
    const result = parseScoreImportData({
      jsonData: [
        ['姓名', '弓种', '距离', '赛制', '排名'],
        ['张三', '传统', '18', '排位', '1'],
        ['张三', '', '18', '淘汰', '2'],
        ['张三', '传统', '18', '排位', '1'],
        ['李四', '', '18', '淘汰', '3'],
      ],
      bowTypes,
      distances,
      competitionFormats: formats,
      managedScores: [],
      eventRegistrations: [
        { name: '张三', club: '甲俱乐部', distance: '18m', competition_bow_type: 'traditional' },
      ],
      selectedEventId: '12',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.successMessage).toContain('已解析 4 条')
    expect(result.scores).toHaveLength(4)
    expect(result.scores[0]).toMatchObject({
      event_id: 12,
      bow_type: 'traditional',
      distance: '18m',
      format: 'ranking',
      __valid: true,
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: false,
    })
    expect(result.scores[1]).toMatchObject({
      bow_type: '',
      distance: '18m',
      format: 'elimination',
      __valid: false,
    })
    expect(result.scores[2]).toMatchObject({
      __valid: true,
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: true,
      __duplicate: true,
    })
    expect(result.scores[1].__errors).toContain('弓种无效：-')
    expect(result.scores[3].__errors).toContain('弓种无效：-')
  })

  it('rejects bow type and format code values during import parsing', () => {
    const result = parseScoreImportData({
      jsonData: [
        ['姓名', '弓种', '距离', '赛制', '排名'],
        ['张三', 'barebow', '18m', 'ranking', '1'],
      ],
      bowTypes,
      distances,
      competitionFormats: formats,
      managedScores: [],
      eventRegistrations: [],
      selectedEventId: '12',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.scores).toHaveLength(1)
    expect(result.scores[0].__valid).toBe(false)
    expect(result.scores[0].__errors).toContain('弓种无效：barebow')
    expect(result.scores[0].__errors).toContain('赛制无效：ranking')
    expect(result.scores[0].distance).toBe('18m')
  })

  it('marks scores without matching registrations as invalid', () => {
    const result = parseScoreImportData({
      jsonData: [
        ['姓名', '弓种', '距离', '赛制', '排名'],
        ['张三', '传统', '18m', '排位', '1'],
      ],
      bowTypes,
      distances,
      competitionFormats: formats,
      managedScores: [],
      eventRegistrations: [],
      selectedEventId: '12',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.scores[0].__valid).toBe(false)
    expect(result.scores[0].__errors).toContain('未找到对应报名记录')
  })

  it('treats empty bow type as invalid instead of inferring it', () => {
    const result = parseScoreImportData({
      jsonData: [
        ['姓名', '弓种', '距离', '赛制', '排名'],
        ['张三', '', '18m', '排位', '1'],
      ],
      bowTypes,
      distances,
      competitionFormats: formats,
      managedScores: [
        { name: '张三', bow_type: 'traditional', distance: '18m', format: 'ranking' },
      ],
      eventRegistrations: [
        { name: '张三', club: '甲俱乐部', distance: '18m', competition_bow_type: 'traditional' },
      ],
      selectedEventId: '12',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.scores[0].__valid).toBe(false)
    expect(result.scores[0].bow_type).toBe('')
    expect(result.scores[0].__errors).toContain('弓种无效：-')
  })

  it('treats same name distance bow format as duplicate regardless of club source', () => {
    expect(
      buildScoreUniqueKey({
        name: '张三',
        club: '甲俱乐部',
        bow_type: 'traditional',
        distance: '18m',
        format: 'ranking',
      })
    ).toBe(
      buildScoreUniqueKey({
        name: '张三',
        club: '乙俱乐部',
        bow_type: 'traditional',
        distance: '18m',
        format: 'ranking',
      })
    )
  })

  it('recalculates duplicate flags after removing preview rows', () => {
    const updatedScores = recalculateDuplicateFlags(
      [
        {
          name: '张三',
          bow_type: 'traditional',
          distance: '18m',
          format: 'ranking',
          __valid: true,
        },
        {
          name: '张三',
          bow_type: 'traditional',
          distance: '18m',
          format: 'ranking',
          __valid: true,
        },
      ],
      [
        {
          name: '王五',
          bow_type: 'compound',
          distance: '18m',
          format: 'ranking',
        },
      ]
    )

    expect(updatedScores[0]).toMatchObject({
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: false,
      __duplicate_with_existing: false,
      __duplicate: false,
    })
    expect(updatedScores[1]).toMatchObject({
      __duplicate_in_file: true,
      __duplicate_in_file_to_remove: true,
      __duplicate_with_existing: false,
      __duplicate: true,
    })
  })
})
