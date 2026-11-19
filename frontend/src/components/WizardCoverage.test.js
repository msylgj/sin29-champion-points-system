import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive } from 'vue'
import WizardCoverage from './WizardCoverage.vue'

const api = vi.hoisted(() => ({ dictionaries: vi.fn(), registrations: vi.fn(), scores: vi.fn(), write: vi.fn() }))
vi.mock('@/api', () => ({
  dictionaryAPI: { getAll: api.dictionaries },
  eventRegistrationAPI: { getList: api.registrations, batchImport: api.write, update: api.write, delete: api.write },
  scoreAPI: { getList: api.scores, batchImport: api.write, update: api.write, delete: api.write },
}))
const event = { id: 7, year: 2026, season: '秋季赛' }
const data = () => ({
  bowTypes: [{ code: 'recurve', name: '反曲弓' }, { code: 'compound', name: '复合弓' }],
  distances: [{ code: '30m', name: '30米' }, { code: '50m', name: '50米' }],
  competitionGroups: [{ bow_type: 'recurve', distance: '30m', group_code: 'A' }, { bow_type: 'compound', distance: '50m', group_code: 'A' }],
  competitionFormats: [{ code: 'ranking', name: '排位赛' }, { code: 'elimination', name: '淘汰赛' }, { code: 'mixed_doubles', name: '混双赛' }, { code: 'team', name: '团体赛' }],
  competitionGenderGroups: [{ code: 'men', name: '男子组' }, { code: 'women', name: '女子组' }, { code: 'mixed', name: '混合组' }],
})
const registration = (id, overrides = {}) => ({ id, year: event.year, season: event.season, competition_bow_type: 'recurve', points_bow_type: 'recurve', distance: '30m', ...overrides })
const score = (id, overrides = {}) => ({ id, event_id: event.id, bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men', ...overrides })
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const mounted = []
const mount = (overrides = {}) => {
  const props = reactive({ event: { ...event }, kind: 'registrations', ...overrides })
  const ready = vi.fn()
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({ render: () => h(WizardCoverage, { ...props, onReady: ready }) })
  app.mount(root)
  const view = { root, app, props, ready }
  mounted.push(view)
  return view
}
const waitReady = view => vi.waitFor(() => expect(view.ready).toHaveBeenLastCalledWith(true))
const waitError = view => vi.waitFor(() => expect(view.root.querySelector('[data-test=coverage-error]')).not.toBeNull())
const row = (view, bow, distance, format = '', gender = '') => [...view.root.querySelectorAll('[data-test=coverage-row]')].find(node => node.dataset.combination === JSON.stringify([bow, distance, format, gender]))

async function filter(view, column, value) {
  const select = view.root.querySelector('[data-filter=' + column + ']')
  select.value = JSON.stringify(value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  vi.resetAllMocks()
  api.dictionaries.mockResolvedValue({ success: true, data: data() })
  api.registrations.mockResolvedValue({ items: [], total: 0 })
  api.scores.mockResolvedValue({ items: [], total: 0 })
})
afterEach(() => {
  mounted.splice(0).forEach(({ app, root }) => { app.unmount(); root.remove() })
  expect(api.write).not.toHaveBeenCalled()
})

describe('WizardCoverage saved-data review', () => {
  it('loads exact-season registrations, labels dictionary pairs and emits readiness only after success', async () => {
    const pending = deferred()
    api.dictionaries.mockReturnValueOnce(pending.promise)
    api.registrations.mockResolvedValue({ items: [registration(1), registration(2)], total: 2 })
    const view = mount()
    expect(view.ready.mock.calls).toEqual([[false]])
    expect(api.registrations).not.toHaveBeenCalled()
    expect(view.root.querySelector('[data-test=coverage-reload]').disabled).toBe(true)
    pending.resolve({ data: data() })
    await waitReady(view)
    expect(api.registrations).toHaveBeenCalledExactlyOnceWith({ year: 2026, season: '秋季赛', page: 1, page_size: 100 })
    expect(api.scores).not.toHaveBeenCalled()
    expect(view.root.textContent).not.toContain('组合来源')
    expect(row(view, 'recurve', '30m').textContent).toContain('反曲弓30米✓ 已有记录2')
    expect(row(view, 'compound', '50m').dataset.covered).toBe('false')
    expect(view.root.textContent).toContain('不保证逐名无遗漏')
    expect(view.root.textContent).toContain('暂无记录不表示该组合必须参赛')
    expect(view.root.querySelector('input')).toBeNull()
  })

  it('uses event_id and keeps format, gender, blank and historical score groups separate', async () => {
    api.scores.mockResolvedValue({ items: [score(1), score(2, { gender_group: 'women' }), score(3, { gender_group: null }), score(4, { format: 'mixed_doubles', gender_group: 'mixed' }), score(5, { bow_type: 'legacy', distance: '90m', format: 'old-format', gender_group: 'mixed' })], total: 5 })
    const view = mount({ kind: 'scores' })
    await waitReady(view)
    expect(api.scores).toHaveBeenCalledExactlyOnceWith({ event_id: 7, page: 1, page_size: 100 })
    expect(api.registrations).not.toHaveBeenCalled()
    expect(row(view, 'recurve', '30m', 'ranking', 'men').dataset.covered).toBe('true')
    expect(row(view, 'recurve', '30m', 'ranking', 'women').dataset.covered).toBe('true')
    expect(row(view, 'recurve', '30m', 'ranking', 'mixed')).toBeUndefined()
    expect(row(view, 'recurve', '30m', 'ranking', '').textContent).toContain('未分组（已有数据）')
    expect(row(view, 'recurve', '30m', 'mixed_doubles', 'men')).toBeUndefined()
    expect(row(view, 'legacy', '90m', 'old-format', 'mixed').dataset.covered).toBe('true')
    expect(view.root.textContent).not.toContain('组合来源')
  })

  it('combines registration filters in the headers and restores all rows on clear', async () => {
    api.registrations.mockResolvedValue({ items: [registration(1)], total: 1 })
    const view = mount()
    await waitReady(view)
    expect(view.root.querySelector('[data-filter=format]')).toBeNull()
    await filter(view, 'bowType', 'recurve')
    expect(row(view, 'compound', '50m')).toBeUndefined()
    expect(row(view, 'recurve', '30m')).toBeDefined()
    await filter(view, 'covered', false)
    expect(view.root.textContent).toContain('暂无符合筛选条件')
    view.root.querySelector('.btn-clear-filters').click()
    await nextTick()
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(2)
    expect(view.ready).toHaveBeenLastCalledWith(true)
    expect(api.registrations).toHaveBeenCalledOnce()
  })

  it('filters visible scores by format and group without restoring suppressed sibling rows', async () => {
    api.scores.mockResolvedValue({ items: [score(1), score(2, { gender_group: 'mixed' })], total: 2 })
    const view = mount({ kind: 'scores' })
    await waitReady(view)
    expect(row(view, 'recurve', '30m', 'ranking', 'men')).toBeUndefined()
    await filter(view, 'format', 'ranking')
    await filter(view, 'genderGroup', 'mixed')
    expect(row(view, 'recurve', '30m', 'ranking', 'mixed').dataset.covered).toBe('true')
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(2)
    await filter(view, 'covered', true)
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(1)
    expect(view.root.querySelector('[data-test=coverage-summary]').textContent).toContain('已读取 2 条')
  })

  it.each(['ranking', 'elimination', 'team', 'mixed_doubles'])('suppresses alternate 18m and 10m bow rows in %s only', async format => {
    const separate = ['barebow', 'longbow', 'traditional']
    const family = ['sightless', ...separate]
    const dictionaries = data()
    dictionaries.distances.push({ code: '18m', name: '18米' }, { code: '10m', name: '10米' })
    dictionaries.competitionGroups.push(...family.flatMap(bow_type => ['18m', '10m'].map(distance => ({ bow_type, distance }))))
    api.dictionaries.mockResolvedValue({ data: dictionaries })
    const gender_group = format === 'mixed_doubles' ? 'mixed' : 'men'
    const items = [
      ...separate.map((bow_type, index) => score(index + 1, { bow_type, distance: '18m', format, gender_group })),
      score(4, { bow_type: 'sightless', distance: '10m', format, gender_group }),
    ]
    api.scores.mockResolvedValue({ items, total: items.length })

    const view = mount({ kind: 'scores' })
    await waitReady(view)
    for (const group of ['men', 'women', 'mixed']) {
      expect(row(view, 'sightless', '18m', format, group)).toBeUndefined()
      for (const bow of separate) expect(row(view, bow, '10m', format, group)).toBeUndefined()
    }
    for (const item of items) {
      expect(row(view, item.bow_type, item.distance, format, gender_group).dataset.covered).toBe('true')
    }
    const otherFormat = format === 'ranking' ? 'team' : 'ranking'
    expect(row(view, 'sightless', '18m', otherFormat, 'men').dataset.covered).toBe('false')
    expect(row(view, 'barebow', '10m', otherFormat, 'men').dataset.covered).toBe('false')

    await filter(view, 'format', format)
    await filter(view, 'distance', '18m')
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(format === 'mixed_doubles' ? 3 : 6)
    await filter(view, 'distance', '10m')
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(format === 'mixed_doubles' ? 1 : 2)
  })

  it('retains all scored team bows while hiding only empty alternate bow rows at 10m and 18m', async () => {
    const separate = ['barebow', 'longbow', 'traditional']
    const distances = ['10m', '18m']
    const dictionaries = data()
    dictionaries.distances.push({ code: '10m', name: '10米' }, { code: '18m', name: '18米' })
    dictionaries.competitionGroups.push(...['sightless', ...separate].flatMap(bow_type => distances.map(distance => ({ bow_type, distance }))))
    api.dictionaries.mockResolvedValue({ data: dictionaries })
    const items = distances.flatMap(distance => [
      { bow_type: 'sightless', distance, format: 'team', gender_group: 'mixed' },
      { bow_type: 'sightless', distance, format: 'team', gender_group: 'men' },
      ...separate.map(bow_type => ({ bow_type, distance, format: 'team', gender_group: 'men' })),
    ]).map((item, index) => score(index + 1, item))
    api.scores.mockResolvedValue({ items, total: items.length })

    const view = mount({ kind: 'scores' })
    await waitReady(view)
    for (const distance of distances) {
      for (const bow of separate) {
        expect(row(view, bow, distance, 'team', 'men').dataset.covered).toBe('true')
        for (const group of ['women', 'mixed']) expect(row(view, bow, distance, 'team', group)).toBeUndefined()
        expect(row(view, bow, distance, 'ranking', 'men')).toBeDefined()
      }
      expect(row(view, 'sightless', distance, 'team', 'mixed').dataset.covered).toBe('true')
      expect(row(view, 'sightless', distance, 'team', 'men')).toBeUndefined()
    }
    expect(row(view, 'recurve', '30m', 'team', 'men')).toBeDefined()
    expect(view.root.querySelector('[data-test=coverage-summary]').textContent).toContain('已读取 10 条')
  })

  it('reads every page and does not announce ready while later pages are pending', async () => {
    const second = deferred()
    api.registrations.mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, index) => registration(index + 1)), total: 101 }).mockReturnValueOnce(second.promise)
    const view = mount()
    await vi.waitFor(() => expect(api.registrations).toHaveBeenCalledTimes(2))
    expect(view.ready.mock.calls).toEqual([[false]])
    expect(view.root.querySelector('[data-test=coverage-row]')).toBeNull()
    expect(api.registrations.mock.calls[1][0]).toEqual({ year: 2026, season: '秋季赛', page: 2, page_size: 100 })
    second.resolve({ items: [registration(101, { competition_bow_type: 'compound', distance: '50m' })], total: 101 })
    await waitReady(view)
    expect(view.root.querySelector('[data-test=coverage-summary]').textContent).toContain('已读取 101 条')
    expect(row(view, 'recurve', '30m').children[3].textContent).toBe('100')
    expect(row(view, 'compound', '50m').children[3].textContent).toBe('1')
  })

  it('keeps dictionary failures unready and supports retry without mutating saved data', async () => {
    api.dictionaries.mockRejectedValueOnce(new Error('字典暂时不可用'))
    const view = mount()
    await waitError(view)
    expect(view.root.textContent).toContain('字典暂时不可用')
    expect(api.registrations).not.toHaveBeenCalled()
    expect(view.ready.mock.calls).toEqual([[false]])
    view.root.querySelector('.btn-retry-inline').click()
    await waitReady(view)
    expect(view.ready.mock.calls).toEqual([[false], [false], [true]])
    expect(view.root.querySelector('[data-test=coverage-error]')).toBeNull()
  })

  it('rejects malformed dictionary responses instead of presenting successful empty coverage', async () => {
    api.dictionaries.mockResolvedValue({ data: {} })
    const view = mount()
    await waitError(view)
    expect(view.root.textContent).toContain('字典响应不完整')
    expect(view.ready).not.toHaveBeenCalledWith(true)
    expect(api.registrations).not.toHaveBeenCalled()
  })

  it('hides partial data on later-page errors and re-reads from page one on retry', async () => {
    let failSecond = true
    api.registrations.mockImplementation(async ({ page }) => {
      if (page === 1) return { items: Array.from({ length: 100 }, (_, index) => registration(index + 1)), total: 101 }
      if (failSecond) throw { detail: '第二页读取失败' }
      return { items: [registration(101)], total: 101 }
    })
    const view = mount()
    await waitError(view)
    expect(view.root.textContent).toContain('第二页读取失败')
    expect(view.root.querySelector('[data-test=coverage-row]')).toBeNull()
    expect(view.ready).not.toHaveBeenCalledWith(true)
    failSecond = false
    view.root.querySelector('.btn-retry-inline').click()
    await waitReady(view)
    expect(api.registrations.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1, 2])
  })

  it('rejects repeated page IDs and incomplete responses without a false checkmark', async () => {
    api.registrations.mockResolvedValue({ items: Array.from({ length: 100 }, (_, index) => registration(index + 1)), total: 101 })
    const view = mount()
    await waitError(view)
    expect(api.registrations).toHaveBeenCalledTimes(2)
    expect(view.root.textContent).toContain('重复')
    expect(view.ready).not.toHaveBeenCalledWith(true)
  })

  it('permits reviewing an empty saved list but never assumes missing combinations must participate', async () => {
    const view = mount()
    await waitReady(view)
    expect(view.root.querySelector('[data-test=coverage-empty]')).not.toBeNull()
    expect(view.root.querySelectorAll('[data-test=coverage-row]')).toHaveLength(2)
    expect(view.root.querySelectorAll('[data-covered=true]')).toHaveLength(0)
  })

  it.each(['registrations', 'scores'])('rejects records belonging to another event (%s)', async kind => {
    if (kind === 'registrations') api.registrations.mockResolvedValue({ items: [registration(1, { season: '春季赛' })], total: 1 })
    else api.scores.mockResolvedValue({ items: [score(1, { event_id: 8 })], total: 1 })
    const view = mount({ kind })
    await waitError(view)
    expect(view.root.textContent).toContain('不属于当前赛事')
    expect(view.ready).not.toHaveBeenCalledWith(true)
  })

  it('discards responses from the previous event after props change', async () => {
    const old = deferred()
    api.registrations.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [registration(2, { year: 2027 })], total: 1 })
    const view = mount()
    await vi.waitFor(() => expect(api.registrations).toHaveBeenCalledTimes(1))
    view.props.event = { ...event, id: 8, year: 2027 }
    await nextTick()
    await waitReady(view)
    old.resolve({ items: [registration(1)], total: 1 })
    await nextTick()
    await Promise.resolve()
    expect(api.registrations.mock.calls[1][0].year).toBe(2027)
    expect(view.ready.mock.calls).toEqual([[false], [false], [true]])
    expect(view.root.querySelector('[data-test=coverage-error]')).toBeNull()
  })

  it('does not emit readiness or load more pages after unmounting', async () => {
    const pending = deferred()
    api.registrations.mockReturnValue(pending.promise)
    const view = mount()
    await vi.waitFor(() => expect(api.registrations).toHaveBeenCalledOnce())
    view.app.unmount()
    mounted.splice(mounted.indexOf(view), 1)
    view.root.remove()
    pending.resolve({ items: Array.from({ length: 100 }, (_, index) => registration(index + 1)), total: 101 })
    await Promise.resolve()
    await Promise.resolve()
    expect(api.registrations).toHaveBeenCalledOnce()
    expect(view.ready.mock.calls).toEqual([[false]])
  })

  it('invalidates previously successful readiness immediately when refreshing', async () => {
    const view = mount()
    await waitReady(view)
    api.registrations.mockRejectedValueOnce(new Error('刷新失败'))
    view.root.querySelector('[data-test=coverage-reload]').click()
    expect(view.ready).toHaveBeenLastCalledWith(false)
    await waitError(view)
    expect(view.root.querySelector('[data-test=coverage-summary]')).toBeNull()
  })
})
