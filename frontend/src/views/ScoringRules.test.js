import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

const listRules = vi.fn()
const createRule = vi.fn()
const deleteRule = vi.fn()
const listEvents = vi.fn()
const dictionaryGet = vi.fn()
const routerPush = vi.fn()
vi.mock('@/api', () => ({
  scoringRuleAPI: { getList: listRules, create: createRule, delete: deleteRule },
  eventAPI: { getList: listEvents },
  dictionaryAPI: { getAll: dictionaryGet },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }))

const config = () => ({
  ranking_points: [10, 8], elimination_points: [12, 9], team_points: [8, 6],
  individual_coefficients: [{ min_count: 2, max_count: 5, coefficient: 0.5, cutoff: 3 }, { min_count: 6, max_count: null, coefficient: 1, cutoff: 8 }],
  team_coefficients: [{ min_count: 2, max_count: null, coefficient: 1, cutoff: 8 }],
  group_multipliers: { S: 1.5, A: 1, B: 0.5, C: 0.25 },
  competition_groups: [{ bow_type: 'barebow', distance: '30m', group_code: 'S' }],
  fallback_base_points: 0.5, default_participant_count: 20, precision: 1, rounding: 'half_up',
})
const rule = (id, overrides = {}) => ({ id, name: '规则' + id, source_rule_id: id === 1 ? null : id - 1, start: id === 1 ? null : { year: 2026, season: '春季赛' }, end: null, created_at: '2026-01-01T00:00:00', config: config(), ...overrides })
const flush = async () => { for (let n = 0; n < 8; n += 1) { await Promise.resolve(); await nextTick() } }
const views = []
const confirmations = []
let acceptNextConfirmation = true
const answerDialog = async () => {
  const dialog = document.querySelector('[role=dialog]')
  if (!dialog) return
  confirmations.push(dialog.textContent)
  const accepted = acceptNextConfirmation
  acceptNextConfirmation = true
  dialog.querySelector(accepted ? '[data-test=confirm-action]' : '[data-test=cancel-action]').click()
  await flush()
}
const act = async node => { node.click(); await flush(); await answerDialog() }
async function mount() {
  const { default: ScoringRules } = await import('./ScoringRules.vue')
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp(ScoringRules)
  app.mount(root)
  views.push({ app, root })
  await flush()
  return root
}
const button = (root, text) => [...root.querySelectorAll('button')].find(node => node.textContent.includes(text))
const input = async (root, selector, value, event = 'input') => {
  const node = root.querySelector(selector)
  node.value = String(value)
  node.dispatchEvent(new Event(event, { bubbles: true }))
  await flush()
}
const tableRows = (root, caption) => {
  const table = [...root.querySelectorAll('.rule-readonly-tables table')].find(node => node.caption.textContent === caption)
  return [...table.tBodies[0].rows].map(row => [...row.cells].map(cell => cell.textContent.trim()))
}
const begin = async root => { await act(root.querySelector('[data-test=create-rule]')) }
const fillBasics = async root => { await input(root, '#rule-name', '新计分规则'); await input(root, '#rule-end-event', 99, 'change') }
const submit = async root => { root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush(); await answerDialog() }

beforeEach(() => {
  vi.resetAllMocks()
  confirmations.length = 0
  acceptNextConfirmation = true
  listRules.mockResolvedValue({ items: [rule(2), rule(1, { end: { year: 2025, season: '冬季赛' } })] })
  listEvents.mockImplementation(async ({ page }) => page === 1 ? { total: 3, items: [{ id: 1, year: 2027, season: '春季赛' }, { id: 99, year: 2026, season: '冬季赛' }] } : { total: 3, items: [{ id: 500, year: 2025, season: '秋季赛' }] })
  dictionaryGet.mockResolvedValue({ data: { bowTypes: [{ code: 'barebow', name: '光弓' }], distances: [{ code: '30m', name: '30米' }], competitionGroups: [{ bow_type: 'barebow', distance: '30m', group_code: 'C' }] } })
  createRule.mockImplementation(async payload => rule(3, { name: payload.name, config: payload.config, start: { year: 2027, season: '春季赛' } }))
  deleteRule.mockResolvedValue({ deleted_rule_id: 2, restored_rule: rule(1) })
  vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('Native confirmation must not be used') })
})
afterEach(() => { views.splice(0).forEach(({ app, root }) => { app.unmount(); root.remove() }); vi.restoreAllMocks(); vi.useRealTimers() })

describe('rule management page', () => {
  it('uses a single project dialog and freezes editing until save is confirmed or canceled', async () => {
    const root = await mount()
    await begin(root); await fillBasics(root)
    const form = root.querySelector('form')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1)
    expect(document.querySelector('[role=dialog] h3').textContent).toBe('保存新规则')
    expect(createRule).not.toHaveBeenCalled()
    expect(root.querySelector('#rule-name').matches(':disabled')).toBe(true)
    expect(root.querySelector('[data-test=reload-rules]').disabled).toBe(true)
    document.querySelector('[data-test=cancel-action]').click()
    await flush()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(createRule).not.toHaveBeenCalled()
    expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    expect(root.querySelector('#rule-name').matches(':disabled')).toBe(false)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    const confirm = document.querySelector('[data-test=confirm-action]')
    confirm.click(); confirm.click()
    await flush()
    expect(createRule).toHaveBeenCalledOnce()
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('uses the same danger dialog for deletion and cancels safely with Escape', async () => {
    const root = await mount()
    const remove = root.querySelector('[data-test=delete-rule]')
    remove.focus(); remove.click(); remove.click()
    await flush()
    const dialog = document.querySelector('[role=dialog]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('上一版将恢复持续生效')
    expect(dialog.querySelector('[data-test=confirm-action]').classList.contains('danger')).toBe(true)
    expect(deleteRule).not.toHaveBeenCalled()
    expect(root.querySelector('.btn-back').disabled).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(deleteRule).not.toHaveBeenCalled()
    expect(root.querySelector('[data-test=rule-history] h2').textContent).toContain('规则2')
    expect(document.activeElement).toBe(remove)
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('cancels a pending confirmation when the page unmounts without sending an API request', async () => {
    const root = await mount()
    await begin(root); await fillBasics(root)
    root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(document.querySelector('[role=dialog]')).not.toBeNull()
    const view = views.pop()
    view.app.unmount(); view.root.remove()
    await flush()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(createRule).not.toHaveBeenCalled()
  })

  it.each(['success', 'error'])('uses existing floating %s feedback and hides it after five seconds', async type => {
    vi.useFakeTimers()
    if (type === 'error') createRule.mockRejectedValueOnce({ status: 422, detail: '保存失败，草稿保留' })
    const root = await mount()
    await begin(root); await fillBasics(root); await submit(root)
    const selector = '.' + type + '-message'
    expect(root.querySelector(selector)).not.toBeNull()
    expect(root.querySelector(selector).getAttribute('role')).toBe(type === 'success' ? 'status' : 'alert')
    await vi.advanceTimersByTimeAsync(4999)
    expect(root.querySelector(selector)).not.toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(root.querySelector(selector)).toBeNull()
    if (type === 'error') {
      expect(root.querySelector('.failure-notice').textContent).toContain('保存失败，草稿保留')
      expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    }
  })


  it('keeps the score-management dropdowns for snapshot editing only', async () => {
    const root = await mount()
    await begin(root)
    for (const [label, value, text] of [['弓种', 'barebow', '光弓'], ['距离', '30m', '30米']]) {
      const control = root.querySelector('[aria-label="快照1' + label + '"]')
      expect(control.matches('select.cell-input:not(:disabled)')).toBe(true)
      expect(control.value).toBe(value)
      expect(control.selectedOptions[0].textContent).toBe(text)
    }
    expect(root.querySelector('datalist')).toBeNull()
  })

  it('requires an explicit group choice for a newly added snapshot', async () => {
    const root = await mount()
    await begin(root); await fillBasics(root)
    const draft = root.querySelector('[data-test=rule-draft]')
    button(draft, '添加组别快照').click()
    await flush()
    expect(draft.querySelector('[aria-label="快照1组别"]').value).toBe('S')
    const group = draft.querySelector('[aria-label="快照2组别"]')
    expect(group.value).toBe('')
    expect(group.selectedOptions[0].textContent).toBe('请选择组别')
    expect(group.selectedOptions[0].disabled).toBe(true)
    await input(draft, '[aria-label="快照2弓种"]', 'recurve', 'change')
    await input(draft, '[aria-label="快照2距离"]', '50m', 'change')
    await submit(root)
    expect(createRule).not.toHaveBeenCalled()
    await input(draft, '[aria-label="快照2组别"]', 'A', 'change')
    await submit(root)
    expect(createRule.mock.calls[0][0].config.competition_groups[1].group_code).toBe('A')
  })

  it('submits changed bow and distance selections without mutating the published snapshot', async () => {
    const published = await listRules()
    const root = await mount()
    await begin(root); await fillBasics(root)
    const draft = root.querySelector('[data-test=rule-draft]')
    await input(draft, '[aria-label="快照1弓种"]', 'recurve', 'change')
    await input(draft, '[aria-label="快照1距离"]', '50m', 'change')
    await submit(root)
    expect(createRule.mock.calls[0][0].config.competition_groups).toEqual([{ bow_type: 'recurve', distance: '50m', group_code: 'S' }])
    expect(published.items[0].config.competition_groups).toEqual([{ bow_type: 'barebow', distance: '30m', group_code: 'S' }])
  })

  it('keeps historical selections visible without dictionaries and offers supported replacement codes', async () => {
    const historical = [{ bow_type: 'retired-bow', distance: '90m', group_code: 'S' }]
    listRules.mockResolvedValue({ items: [rule(2, { config: { ...config(), competition_groups: historical } })] })
    dictionaryGet.mockRejectedValueOnce(new Error('字典离线'))
    const root = await mount()
    expect(tableRows(root, '弓种 / 距离组别快照')).toEqual([['retired-bow', '90m', 'S']])
    await begin(root); await fillBasics(root)
    const draft = root.querySelector('[data-test=rule-draft]')
    expect(draft.querySelector('[aria-label="快照1弓种"]').value).toBe('retired-bow')
    await input(draft, '[aria-label="快照1弓种"]', 'barebow', 'change')
    await input(draft, '[aria-label="快照1距离"]', '30m', 'change')
    await submit(root)
    expect(createRule.mock.calls[0][0].config.competition_groups).toEqual([{ bow_type: 'barebow', distance: '30m', group_code: 'S' }])
    expect(historical).toEqual([{ bow_type: 'retired-bow', distance: '90m', group_code: 'S' }])
  })

  it('lists version validity, displays Chinese labels and keeps every published config read-only', async () => {
    const root = await mount()
    expect(root.textContent).toContain('最初 — 2025年 冬季赛')
    expect(root.textContent).toContain('2026年 春季赛 — 持续生效')
    expect(root.querySelector('.page-header .header-title-wrap h1').textContent).toBe('积分规则管理')
    expect(root.querySelector('[data-test=create-rule]').textContent.trim()).toBe('创建新规则')
    const history = root.querySelector('[data-test=rule-history]')
    expect(history.querySelector('fieldset, input, select, button')).toBeNull()
    expect(history.querySelectorAll('.rule-readonly-tables > div > table')).toHaveLength(8)
    expect(tableRows(history, '排位赛排名积分')).toEqual([['1', '10'], ['2', '8']])
    expect(tableRows(history, '淘汰赛排名积分')).toEqual([['1', '12'], ['2', '9']])
    expect(tableRows(history, '团体/混双赛排名积分')).toEqual([['1', '8'], ['2', '6']])
    expect(tableRows(history, '个人赛人数系数')).toEqual([['2–5', '0.5', '3'], ['6–无上限', '1', '8']])
    expect(tableRows(history, '团体/混双赛人数系数')).toEqual([['2–无上限', '1', '8']])
    expect(tableRows(history, '组别系数')).toEqual([['S', '1.5'], ['A', '1'], ['B', '0.5'], ['C', '0.25']])
    expect(tableRows(history, '弓种 / 距离组别快照')).toEqual([['光弓', '30米', 'S']])
    expect(tableRows(history, '默认值')).toEqual([['兜底基础积分', '0.5'], ['默认参赛人数', '20']])
    root.querySelector('[aria-label="查看规则1"]').click()
    await flush()
    expect(root.querySelector('[data-test=rule-history]').textContent).toContain('规则1')
    root.querySelector('.btn-back').click()
    expect(routerPush).toHaveBeenCalledWith('/event-list')
  })

  it('uses score-list table, select and action styles for all nested rule controls', async () => {
    const root = await mount()
    const versions = root.querySelector('[aria-label="规则版本"] .manage-table')
    expect(versions.closest('.table-wrapper.manage-table-wrap')).not.toBeNull()
    expect(versions.querySelector('[aria-label="查看规则2"]').classList.contains('btn-row-save')).toBe(true)
    expect(versions.querySelector('[data-test=delete-rule]').classList.contains('btn-row-delete')).toBe(true)
    await begin(root)
    expect(root.querySelector('#rule-end-event').classList.contains('manage-filter-select')).toBe(true)
    expect(root.querySelector('#rule-name').classList.contains('manage-search-input')).toBe(true)
    const draft = root.querySelector('[data-test=rule-draft]')
    const tables = [...draft.querySelectorAll('.manage-table')]
    expect(tables).toHaveLength(6)
    for (const table of tables) {
      expect(table.closest('.table-wrapper.manage-table-wrap')).not.toBeNull()
      for (const control of table.querySelectorAll('input, select')) expect(control.classList.contains('cell-input')).toBe(true)
      for (const action of table.querySelectorAll('button')) expect(action.classList.contains('btn-row-delete')).toBe(true)
    }
    expect(draft.querySelectorAll('.btn-add')).toHaveLength(6)
    expect(draft.querySelector('[data-test=save-rule]').classList.contains('btn-primary')).toBe(true)
  })

  it('inherits only the latest snapshot and offers every editable table without mutating history', async () => {
    const response = await listRules()
    const root = await mount()
    root.querySelector('[aria-label="查看规则1"]').click()
    const detailPanel = root.querySelector('[data-test=rule-history]')
    await begin(root)
    expect(root.querySelector('[data-test=rule-history]')).toBeNull()
    expect(root.querySelector('[data-test=rule-draft]')).toBe(detailPanel)
    expect(root.querySelectorAll('.rule-config')).toHaveLength(1)
    expect(root.querySelector('.rule-config').disabled).toBe(false)
    expect(root.querySelector('[data-test=save-rule]').textContent.trim()).toBe('保存规则')
    expect(root.querySelector('[data-test=rule-draft]').textContent).toContain('继承版本 #2')
    const draft = root.querySelector('[data-test=rule-draft]')
    await input(draft, '[aria-label="排位赛第1名积分"]', '12.345')
    await input(draft, '[aria-label="快照1组别"]', 'B', 'change')
    expect(response.items[0].config.ranking_points[0]).toBe(10)
    expect(response.items[0].config.competition_groups[0].group_code).toBe('S')
    expect(draft.querySelector('[aria-label="排位赛第1名积分"]').max).toBe('10000')
    expect(draft.querySelector('[aria-label="个人赛区间1最少人数"]').min).toBe('2')
    expect(draft.querySelector('[aria-label="个人赛区间1名次上限"]').min).toBe('1')
    for (const text of ['添加排位赛名次', '添加淘汰赛名次', '添加团体/混双赛名次', '添加个人赛区间', '添加团体/混双赛区间', '添加组别快照']) { button(draft, text).click(); await flush() }
    expect(draft.querySelectorAll('[aria-label^="排位赛第"]')).toHaveLength(3)
    draft.querySelector('[aria-label="排位赛删除第3名"]').click()
    draft.querySelector('[aria-label="删除快照2"]').click()
    await flush()
    expect(draft.querySelectorAll('[aria-label^="排位赛第"]')).toHaveLength(2)
    expect(draft.querySelector('[aria-label="快照2弓种"]')).toBeNull()
    expect(response.items[0].config.team_coefficients).toHaveLength(1)
  })

  it('cancels inline editing and restores the unchanged read-only rule', async () => {
    const root = await mount()
    await begin(root)
    await input(root.querySelector('[data-test=rule-draft]'), '[aria-label="排位赛第1名积分"]', 42)
    await act(button(root, '取消编辑'))
    expect(root.querySelector('[data-test=rule-draft]')).toBeNull()
    expect(root.querySelectorAll('.rule-readonly')).toHaveLength(1)
    const history = root.querySelector('[data-test=rule-history]')
    expect(history.querySelector('input, select')).toBeNull()
    expect(tableRows(history, '排位赛排名积分')[0]).toEqual(['1', '10'])
    expect(createRule).not.toHaveBeenCalled()
  })

  it('loads all event pages chronologically, excludes invalid past cutoffs and previews winter rollover', async () => {
    const root = await mount()
    await begin(root)
    const choices = [...root.querySelectorAll('#rule-end-event option')].slice(1)
    expect(choices.map(node => node.value)).toEqual(['99', '1'])
    expect(listEvents).toHaveBeenCalledWith({ page: 2, page_size: 100 })
    await input(root, '#rule-end-event', 99, 'change')
    expect(root.querySelector('[data-test=start-preview]').textContent).toContain('2027年 春季赛')
  })

  it('updates the start-season hint for every cutoff and resets it when cleared', async () => {
    const seasons = ['春季赛', '夏季赛', '秋季赛', '冬季赛']
    listEvents.mockResolvedValue({ total: 4, items: seasons.map((season, index) => ({ id: index + 11, year: 2026, season })) })
    const root = await mount()
    await begin(root)
    const preview = () => root.querySelector('[data-test=start-preview]').textContent.trim()
    expect(preview()).toBe('请选择截止赛季')
    for (let index = 0; index < seasons.length; index += 1) {
      await input(root, '#rule-end-event', index + 11, 'change')
      const start = index === 3 ? '2027年 春季赛' : '2026年 ' + seasons[index + 1]
      expect(preview()).toBe('新版起始赛季：' + start + '（前版适用至2026年 ' + seasons[index] + '，含该赛季）')
    }
    await input(root, '#rule-end-event', '', 'change')
    expect(preview()).toBe('请选择截止赛季')
  })

  it('validates required fields and numeric limits before confirming publication', async () => {
    const root = await mount()
    await begin(root)
    await submit(root)
    expect(root.textContent).toContain('请填写规则名称')
    await input(root, '#rule-name', '测试规则')
    await submit(root)
    expect(root.textContent).toContain('请选择前版截止赛事')
    await input(root, '#rule-end-event', 99, 'change')
    await input(root.querySelector('[data-test=rule-draft]'), '[aria-label="排位赛第1名积分"]', 10001)
    await submit(root)
    expect(root.textContent).toContain('0～10000')
    expect(createRule).not.toHaveBeenCalled()
  })

  it('requires an irreversible confirmation, submits the complete inherited contract and prevents duplicate saves', async () => {
    let finish
    createRule.mockImplementation(payload => new Promise(resolve => { finish = () => resolve(rule(3, { name: payload.name, config: payload.config })) }))
    const root = await mount()
    await begin(root)
    await fillBasics(root)
    await input(root.querySelector('[data-test=rule-draft]'), '[aria-label="排位赛第1名积分"]', 42)
    acceptNextConfirmation = false
    await submit(root)
    expect(createRule).not.toHaveBeenCalled()
    await submit(root)
    await submit(root)
    expect(createRule).toHaveBeenCalledOnce()
    expect(confirmations.at(-1)).toContain('包括已有赛事，将按新规则重算')
    expect(root.querySelector('[data-test=save-rule]').disabled).toBe(true)
    expect(root.querySelector('#rule-name').matches(':disabled')).toBe(true)
    expect(createRule.mock.calls[0][0]).toEqual({ name: '新计分规则', base_rule_id: 2, previous_end_event_id: 99, config: { ...config(), ranking_points: [42, 8] } })
    finish()
    await flush()
    expect(root.querySelector('[data-test=rule-draft]')).toBeNull()
    expect(root.textContent).toContain('新规则已保存')
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    const saved = root.querySelector('[data-test=rule-history]')
    expect(saved.querySelector('input, select')).toBeNull()
    expect(tableRows(saved, '排位赛排名积分')[0]).toEqual(['1', '42'])
    expect(root.querySelectorAll('.rule-readonly')).toHaveLength(1)
    expect(root.textContent).toContain('2026年 春季赛 — 2026年 冬季赛')
  })

  it('retains failed drafts, requires reloading after 409 and never silently rebases their config', async () => {
    createRule.mockRejectedValueOnce({ status: 409, detail: '请继承最新版本' })
    const root = await mount()
    await begin(root)
    await fillBasics(root)
    await input(root.querySelector('[data-test=rule-draft]'), '[aria-label="排位赛第1名积分"]', 42)
    await submit(root)
    expect(root.textContent).toContain('草稿已保留')
    expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
    await submit(root)
    expect(createRule).toHaveBeenCalledOnce()
    listRules.mockResolvedValue({ items: [rule(3), rule(2), rule(1)] })
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=rule-draft] [aria-label="排位赛第1名积分"]').value).toBe('42')
    expect(root.querySelector('[data-test=save-rule]').disabled).toBe(true)
    acceptNextConfirmation = false
    await begin(root)
    expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    await begin(root)
    expect(root.querySelector('[data-test=rule-draft]').textContent).toContain('继承版本 #3')
    expect(root.querySelector('#rule-name').value).toBe('')
  })

  it('can recover after canceling a conflict draft without a whole-page refresh', async () => {
    createRule.mockRejectedValueOnce({ status: 409, detail: '版本冲突' })
    const root = await mount()
    await begin(root); await fillBasics(root); await submit(root)
    await act(button(root, '取消编辑'))
    expect(root.querySelector('[data-test=rule-draft]')).toBeNull()
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(false)
    await begin(root)
    expect(root.querySelector('[data-test=rule-draft]')).not.toBeNull()
  })

  it('preserves a draft on 422, shows field errors and can retry', async () => {
    createRule.mockRejectedValueOnce({ status: 422, detail: [{ loc: ['body', 'config'], msg: '服务端配置校验失败' }] })
    const root = await mount()
    await begin(root); await fillBasics(root); await submit(root)
    expect(root.textContent).toContain('body.config：服务端配置校验失败')
    expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    expect(root.querySelector('[data-test=save-rule]').disabled).toBe(false)
    await submit(root)
    expect(createRule).toHaveBeenCalledTimes(2)
  })

  it('handles absent events, failed list loads and a dictionary outage without replacing snapshots', async () => {
    listEvents.mockResolvedValue({ items: [], total: 0 })
    dictionaryGet.mockRejectedValue(new Error('离线'))
    const root = await mount()
    expect(root.textContent).toContain('暂无赛事')
    expect(root.textContent).toContain('字典加载失败')
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
    expect(tableRows(root, '弓种 / 距离组别快照')).toEqual([['barebow', '30m', 'S']])
    listRules.mockRejectedValueOnce({ detail: '加载中断' })
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.textContent).toContain('规则加载失败：加载中断')
    button(root, '重试加载规则').click()
    await flush()
    expect(root.textContent).not.toContain('规则加载失败')
  })

  it('explains why no cutoff is available after the latest rule start', async () => {
    listRules.mockResolvedValue({ items: [rule(2, { start: { year: 2030, season: '夏季赛' } })] })
    const root = await mount()
    expect(root.textContent).toContain('已有赛事均早于最新规则的起始赛季')
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
  })

  it('shows plain view actions and only the latest deletion action, with initial deletion disabled', async () => {
    const root = await mount()
    expect([...root.querySelectorAll('[aria-label^="查看规则"]')].map(node => node.textContent.trim())).toEqual(['查看', '查看'])
    expect(root.querySelectorAll('[data-test=delete-rule]')).toHaveLength(1)
    const latestRow = root.querySelector('[data-test=delete-rule]').closest('tr')
    expect(latestRow.textContent).toContain('#2')
    expect(root.querySelector('[aria-label="查看规则1"]').closest('tr').querySelector('[data-test=delete-rule]')).toBeNull()
    listRules.mockResolvedValue({ items: [rule(1)] })
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    const initialDelete = root.querySelector('[data-test=delete-rule]')
    expect(initialDelete.disabled).toBe(true)
    expect(initialDelete.title).toBe('初始规则不可删除')
    expect(initialDelete.textContent.trim()).toBe('删除')
    initialDelete.click()
    expect(deleteRule).not.toHaveBeenCalled()
  })

  it('does not delete when confirmation is canceled and explains restored scoring', async () => {
    const root = await mount()
    acceptNextConfirmation = false
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(deleteRule).not.toHaveBeenCalled()
    expect(confirmations.join(' ')).toContain('上一版将恢复持续生效')
    expect(confirmations.join(' ')).toContain('原适用赛事及后续积分将按上一版规则重算')
    expect(root.querySelector('[data-test=rule-history] h2').textContent).toContain('规则2')
  })

  it('uses the authoritative restored rule, removes the deleted row and keeps a single readonly detail panel', async () => {
    const restored = rule(1, { name: '服务端恢复版本', config: { ...config(), ranking_points: [77] } })
    deleteRule.mockResolvedValue({ deleted_rule_id: 2, restored_rule: restored })
    const root = await mount()
    const panel = root.querySelector('[data-test=rule-history]')
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(deleteRule).toHaveBeenCalledExactlyOnceWith(2)
    expect(root.querySelector('[aria-label="查看规则2"]')).toBeNull()
    expect(root.querySelector('[aria-label="查看规则1"]').closest('tr').textContent).toContain('最初 — 持续生效')
    expect(root.querySelector('[data-test=rule-history]')).toBe(panel)
    expect(root.querySelectorAll('.rule-readonly')).toHaveLength(1)
    expect(panel.querySelector('input, select')).toBeNull()
    expect(panel.querySelector('h2').textContent).toContain('服务端恢复版本')
    expect(tableRows(panel, '排位赛排名积分')).toEqual([['1', '77']])
    expect(root.querySelector('.success-message').textContent).toContain('已恢复持续生效')
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
  })

  it('restores a noninitial predecessor and can delete that latest version in a separately confirmed action', async () => {
    listRules.mockResolvedValue({ items: [rule(3), rule(2, { end: { year: 2026, season: '冬季赛' } }), rule(1, { end: { year: 2025, season: '冬季赛' } })] })
    deleteRule.mockResolvedValueOnce({ deleted_rule_id: 3, restored_rule: rule(2) }).mockResolvedValueOnce({ deleted_rule_id: 2, restored_rule: rule(1) })
    const root = await mount()
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(false)
    expect(root.querySelector('[data-test=rule-history] h2').textContent).toContain('规则2')
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(deleteRule.mock.calls).toEqual([[3], [2]])
    expect(confirmations).toHaveLength(2)
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
  })

  it('prevents duplicate deletion, creation, refresh, selection and returning during a pending deletion', async () => {
    let finish
    deleteRule.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ deleted_rule_id: 2, restored_rule: rule(1) }) }))
    const root = await mount()
    const deleteButton = root.querySelector('[data-test=delete-rule]')
    deleteButton.click()
    deleteButton.click()
    await flush()
    await answerDialog()
    expect(deleteRule).toHaveBeenCalledOnce()
    expect(confirmations).toHaveLength(1)
    expect(deleteButton.disabled).toBe(true)
    expect(deleteButton.textContent.trim()).toBe('删除')
    expect(deleteButton.getAttribute('aria-busy')).toBe('true')
    for (const selector of ['[data-test=create-rule]', '[data-test=reload-rules]', '[aria-label="查看规则1"]', '.btn-back']) {
      const control = root.querySelector(selector)
      expect(control.disabled).toBe(true)
      control.click()
    }
    await flush()
    expect(listRules).toHaveBeenCalledOnce()
    expect(routerPush).not.toHaveBeenCalled()
    expect(root.querySelector('[data-test=rule-draft]')).toBeNull()
    expect(root.querySelector('[data-test=rule-history] h2').textContent).toContain('规则2')
    finish()
    await flush()
    expect(root.querySelector('.btn-back').disabled).toBe(false)
  })

  it('preserves unsaved edits and prevents deletion during draft editing and saving', async () => {
    let finish
    createRule.mockImplementation(payload => new Promise(resolve => { finish = () => resolve(rule(3, { config: payload.config })) }))
    const root = await mount()
    await begin(root)
    await fillBasics(root)
    await input(root.querySelector('[data-test=rule-draft]'), '[aria-label="排位赛第1名积分"]', 42)
    root.querySelector('[data-test=delete-rule]').click()
    expect(deleteRule).not.toHaveBeenCalled()
    expect(root.querySelector('#rule-name').value).toBe('新计分规则')
    expect(root.querySelector('[data-test=rule-draft] [aria-label="排位赛第1名积分"]').value).toBe('42')
    await submit(root)
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
    root.querySelector('[data-test=delete-rule]').click()
    expect(deleteRule).not.toHaveBeenCalled()
    finish()
    await flush()
  })

  it('disables deletion during loading and after version reload failures until a successful refresh', async () => {
    const root = await mount()
    let finish
    listRules.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ items: [rule(2), rule(1)] }) }))
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
    root.querySelector('[data-test=delete-rule]').click()
    expect(deleteRule).not.toHaveBeenCalled()
    finish(); await flush()
    listRules.mockRejectedValueOnce({ detail: '规则加载失败' })
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(false)
  })

  it.each([404, 409])('keeps deletion error %s visible without a draft and requires refreshing before acting on a newer latest version', async status => {
    deleteRule.mockRejectedValueOnce({ status, detail: '服务端：规则已变化，请刷新' })
    const root = await mount()
    await act(root.querySelector('[data-test=delete-rule]'))
    const error = root.querySelector('[data-test=delete-error]')
    expect(error.textContent).toContain('服务端：规则已变化，请刷新')
    expect(error.closest('[data-test=rule-draft]')).toBeNull()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
    listRules.mockRejectedValueOnce(new Error('刷新网络失败'))
    button(error, '刷新版本列表').click()
    await flush()
    expect(root.querySelector('[data-test=delete-error]')).not.toBeNull()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
    listRules.mockResolvedValue({ items: [rule(3), rule(2), rule(1)] })
    root.querySelector('[data-test=reload-rules]').click()
    await flush()
    expect(root.querySelector('[data-test=delete-error]')).toBeNull()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(false)
    expect(deleteRule).toHaveBeenCalledExactlyOnceWith(2)
    expect(confirmations).toHaveLength(1)
    deleteRule.mockResolvedValueOnce({ deleted_rule_id: 3, restored_rule: rule(2) })
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(confirmations.at(-1)).toContain('规则3')
    expect(deleteRule.mock.calls).toEqual([[2], [3]])
  })

  it('requires a refresh after an incomplete deletion response instead of corrupting the timeline', async () => {
    deleteRule.mockResolvedValue({ deleted_rule_id: 2 })
    const root = await mount()
    await act(root.querySelector('[data-test=delete-rule]'))
    expect(root.querySelector('[data-test=delete-error]').textContent).toContain('删除响应不完整')
    expect(root.querySelector('[aria-label="查看规则2"]')).not.toBeNull()
    expect(root.querySelector('[data-test=delete-rule]').disabled).toBe(true)
  })

  it('does not offer a partial event list after an event-load failure and allows retry', async () => {
    listEvents.mockRejectedValueOnce(new Error('赛事网络错误'))
    const root = await mount()
    expect(root.textContent).toContain('赛事加载失败：赛事网络错误')
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(true)
    button(root, '重试加载赛事').click()
    await flush()
    expect(root.querySelector('[data-test=create-rule]').disabled).toBe(false)
  })
})
