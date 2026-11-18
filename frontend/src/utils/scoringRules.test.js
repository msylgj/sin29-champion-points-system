import { describe, expect, it, vi } from 'vitest'
import { cloneRuleConfig, loadAllRuleEvents, nextSeason, normalizeRuleConfig, ruleErrorMessage, validateRuleConfig } from './scoringRules'

const config = () => ({
  ranking_points: [10, 9], elimination_points: [10], team_points: [8],
  individual_coefficients: [{ min_count: 2, max_count: 5, coefficient: 0.5, cutoff: 3 }, { min_count: 6, max_count: null, coefficient: 1, cutoff: 8 }],
  team_coefficients: [{ min_count: 2, max_count: null, coefficient: 1, cutoff: 8 }],
  group_multipliers: { S: 1.5, A: 1, B: 0.5, C: 0 }, competition_groups: [{ bow_type: 'barebow', distance: '30m', group_code: 'A' }],
  fallback_base_points: 0.5, default_participant_count: 20, precision: 1, rounding: 'half_up',
})

describe('rule draft helpers', () => {
  it('deep clones inherited snapshots without changing precision or dictionary mappings', () => {
    const original = config()
    const draft = cloneRuleConfig(original)
    draft.ranking_points[0] = 99
    draft.competition_groups[0].group_code = 'C'
    draft.individual_coefficients[1].max_count = ''
    const normalized = normalizeRuleConfig(draft)
    expect(original.ranking_points[0]).toBe(10)
    expect(original.competition_groups[0].group_code).toBe('A')
    expect(normalized.individual_coefficients[1].max_count).toBeNull()
    expect(normalized.precision).toBe(1)
    expect(normalized.rounding).toBe('half_up')
    expect(draft.individual_coefficients[1].max_count).toBe('')
    expect(validateRuleConfig(config())).toBe('')
  })
  it.each([
    ['ranking_points', [], '至少保留'], ['ranking_points', [-1], '非负'], ['elimination_points', [''], '非负'],
    ['individual_coefficients', [{ min_count: 1, max_count: null, coefficient: 1, cutoff: 8 }], '从2'],
    ['individual_coefficients', [{ min_count: 2, max_count: 5, coefficient: 1, cutoff: 0 }], '无效'],
    ['individual_coefficients', [{ min_count: 2, max_count: 5, coefficient: 1, cutoff: 8 }, { min_count: 7, max_count: null, coefficient: 1, cutoff: 8 }], '连续'],
    ['team_coefficients', [{ min_count: 2, max_count: 10, coefficient: 1, cutoff: 8 }], '无上限'],
    ['default_participant_count', 1, '不小于2'], ['default_participant_count', 2147483648, '默认参赛人数'],
    ['ranking_points', [10001], '10000'], ['fallback_base_points', 10001, '兜底'], ['fallback_base_points', Infinity, '兜底'],
    ['group_multipliers', { S: 10001, A: 1, B: 0, C: 0 }, '10000'],
    ['team_coefficients', [{ min_count: 2, max_count: null, coefficient: 10001, cutoff: 8 }], '无效'],
    ['team_coefficients', [{ min_count: 2, max_count: null, coefficient: 1, cutoff: 2147483648 }], '无效'],
    ['competition_groups', [{ bow_type: 'unknown', distance: '30m', group_code: 'A' }], '支持的代码'],
    ['competition_groups', Array(2).fill({ bow_type: 'barebow', distance: '30m', group_code: 'A' }), '重复'],
  ])('rejects invalid %s', (key, value, message) => {
    expect(validateRuleConfig({ ...config(), [key]: value })).toContain(message)
  })
  it('accepts the inclusive numeric safety limits', () => {
    const high = config()
    high.ranking_points = [10000]
    high.team_coefficients[0].coefficient = 10000
    high.team_coefficients[0].cutoff = 2147483647
    high.group_multipliers.S = 10000
    high.default_participant_count = 2147483647
    expect(validateRuleConfig(high)).toBe('')
  })
  it('allows zero numeric factors and an empty snapshot', () => {
    expect(validateRuleConfig({ ...config(), competition_groups: [], fallback_base_points: 0 })).toBe('')
  })
  it('advances seasons by chronology including winter rollover, not ids', () => {
    expect(nextSeason({ year: 2026, season: '冬季赛', id: 900 })).toEqual({ year: 2027, season: '春季赛' })
    expect(nextSeason({ year: 2026, season: '春季赛' })).toEqual({ year: 2026, season: '夏季赛' })
    expect(nextSeason({ year: 2026, season: '?' })).toBeNull()
  })
  it('formats server field validation errors for the form', () => {
    expect(ruleErrorMessage({ detail: [{ loc: ['body', 'config'], msg: '配置无效' }] })).toContain('body.config：配置无效')
  })
})

describe('complete existing-event pagination', () => {
  it('loads every page, counts unique ids, and sorts by year/season rather than event id', async () => {
    const getList = vi.fn().mockResolvedValueOnce({ total: 3, items: [{ id: 1, year: 2027, season: '春季赛' }, { id: 99, year: 2026, season: '冬季赛' }] })
      .mockResolvedValueOnce({ total: 3, items: [{ id: 99, year: 2026, season: '冬季赛' }, { id: 500, year: 2026, season: '春季赛' }] })
    expect((await loadAllRuleEvents({ getList })).map(event => event.id)).toEqual([500, 99, 1])
    expect(getList).toHaveBeenNthCalledWith(2, { page: 2, page_size: 100 })
  })
  it('detects nonadvancing or incomplete pages instead of offering an incomplete cutoff list', async () => {
    const item = { id: 1, year: 2026, season: '夏季赛' }
    const getList = vi.fn().mockResolvedValue({ total: 2, items: [item] })
    await expect(loadAllRuleEvents({ getList })).rejects.toThrow('分页重复')
    getList.mockReset().mockResolvedValueOnce({ total: 2, items: [item] }).mockResolvedValueOnce({ total: 2, items: [] })
    await expect(loadAllRuleEvents({ getList })).rejects.toThrow('不完整')
    expect(await loadAllRuleEvents({ getList: vi.fn(async () => ({ total: 0, items: [] })) })).toEqual([])
  })
})
