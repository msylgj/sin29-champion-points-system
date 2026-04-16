import { describe, expect, it } from 'vitest'

import {
  buildRegistrationUniqueKey,
  parseRegistrationImportData,
  recalculateRegistrationDuplicateFlags,
} from './registrationImportParsing'

describe('registration import parsing helpers', () => {
  const bowTypes = [
    { name: '光弓', code: 'barebow' },
    { name: '美猎弓', code: 'longbow' },
    { name: '传统弓', code: 'traditional' },
    { name: '无瞄弓', code: 'sightless' },
    { name: '反曲弓', code: 'recurve' },
    { name: '复合弓', code: 'compound' },
  ]
  const distances = [
    { name: '10米', code: '10m' },
    { name: '18米', code: '18m' },
    { name: '30米', code: '30m' },
  ]
  const competitionGenderGroups = [
    { name: '男子组', code: 'men' },
    { name: '女子组', code: 'women' },
    { name: '混合组', code: 'mixed' },
  ]

  it('parses sightless registrations with fuzzy matched points bow type and group', () => {
    const result = parseRegistrationImportData({
      jsonData: [
        ['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'],
        ['张三', '甲俱乐部', '18', '无瞄', '传统', '混合'],
      ],
      bowTypes,
      distances,
      competitionGenderGroups,
      existingRegistrations: [],
      selectedYear: 2024,
      selectedSeason: '春季赛',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.registrations).toHaveLength(1)
    expect(result.registrations[0]).toMatchObject({
      year: 2024,
      season: '春季赛',
      distance: '18m',
      competition_bow_type: 'sightless',
      points_bow_type: 'traditional',
      competition_gender_group: 'mixed',
      __valid: true,
    })
  })

  it('forces non-sightless points bow type to match competition bow type', () => {
    const result = parseRegistrationImportData({
      jsonData: [
        ['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'],
        ['李四', '乙俱乐部', '30m', '反曲', '传统', '男子'],
      ],
      bowTypes,
      distances,
      competitionGenderGroups,
      existingRegistrations: [],
      selectedYear: 2024,
      selectedSeason: '夏季赛',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.registrations[0]).toMatchObject({
      competition_bow_type: 'recurve',
      points_bow_type: 'recurve',
      competition_gender_group: 'men',
      __valid: true,
    })
  })

  it('marks sightless registrations with invalid points bow type as errors', () => {
    const result = parseRegistrationImportData({
      jsonData: [
        ['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'],
        ['王五', '丙俱乐部', '18m', '无瞄弓', '反曲', '女子组'],
      ],
      bowTypes,
      distances,
      competitionGenderGroups,
      existingRegistrations: [],
      selectedYear: 2024,
      selectedSeason: '秋季赛',
    })

    expect(result.errorMessage).toBeNull()
    expect(result.registrations[0].__valid).toBe(false)
    expect(result.registrations[0].__errors).toContain('无瞄弓的积分弓种仅支持：光弓、美猎弓、传统弓')
  })

  it('recalculates duplicate flags for registrations', () => {
    const duplicated = recalculateRegistrationDuplicateFlags(
      [
        {
          year: 2024,
          season: '春季赛',
          name: '张三',
          club: '甲俱乐部',
          distance: '18m',
          competition_bow_type: 'sightless',
          points_bow_type: 'traditional',
          competition_gender_group: 'mixed',
          __valid: true,
        },
        {
          year: 2024,
          season: '春季赛',
          name: '张三',
          club: '甲俱乐部',
          distance: '18m',
          competition_bow_type: 'sightless',
          points_bow_type: 'traditional',
          competition_gender_group: 'mixed',
          __valid: true,
        },
      ],
      [
        {
          year: 2024,
          season: '春季赛',
          name: '李四',
          club: '乙俱乐部',
          distance: '30m',
          competition_bow_type: 'recurve',
          points_bow_type: 'recurve',
          competition_gender_group: 'men',
        },
      ]
    )

    expect(buildRegistrationUniqueKey(duplicated[0])).toBe(buildRegistrationUniqueKey(duplicated[1]))
    expect(duplicated[0].__duplicate_in_file).toBe(true)
    expect(duplicated[0].__duplicate_in_file_to_remove).toBe(false)
    expect(duplicated[1].__duplicate_in_file_to_remove).toBe(true)
  })
})
