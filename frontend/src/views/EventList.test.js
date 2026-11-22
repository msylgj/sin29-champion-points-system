import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import * as XLSX from 'xlsx/xlsx.mjs'
import EventList from './EventList.vue'

const { push, getList, deleteEvent, rankingScorecards, eliminationRounds, eliminationScorecards, drafts, loadDraft, saveWorkbook, saveConfiguration, deleteDraft } = vi.hoisted(() => ({
  push: vi.fn(), getList: vi.fn(), deleteEvent: vi.fn(), rankingScorecards: vi.fn(),
  eliminationRounds: vi.fn(), eliminationScorecards: vi.fn(), drafts: new Map(),
  loadDraft: vi.fn(), saveWorkbook: vi.fn(), saveConfiguration: vi.fn(), deleteDraft: vi.fn(),
}))
vi.mock('@/utils/scorecardDraftStorage', () => ({
  loadScorecardDraft: loadDraft, saveScorecardWorkbook: saveWorkbook, saveScorecardConfiguration: saveConfiguration, deleteScorecardDraft: deleteDraft,
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api', () => ({ eventAPI: { getList, delete: deleteEvent, rankingScorecards, eliminationRounds, eliminationScorecards } }))
let app
let root
const button = title => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === title)
const event = (id, year, season, registration_count = 0, score_count = 0) => ({ id, year, season, registration_count, score_count })
function mount(component = EventList, props = {}) {
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(component, props)
  app.mount(root)
}
beforeEach(() => {
  for (const mock of [getList, push, deleteEvent, rankingScorecards, eliminationRounds, eliminationScorecards, loadDraft, saveWorkbook, saveConfiguration, deleteDraft]) mock.mockReset()
  drafts.clear()
  loadDraft.mockImplementation(async id => drafts.get(id) ?? null)
  saveWorkbook.mockImplementation(async (id, workbook, configuration) => { drafts.set(id, { workbook, configuration }) })
  saveConfiguration.mockImplementation(async (id, configuration) => { drafts.set(id, { ...drafts.get(id), configuration }) })
  deleteDraft.mockImplementation(async id => { drafts.delete(id) })
})
afterEach(() => { app?.unmount(); root?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('renders the ordered page with saved counts and sends the exact selected ID to each operation', async () => {
  getList.mockResolvedValue({ total: 2, items: [event(42, 2026, '冬季赛', 12, 34), event(89, 2026, '秋季赛')] })
  mount()
  await vi.waitFor(() => expect(root.querySelectorAll('tbody tr')).toHaveLength(2))
  expect(getList).toHaveBeenCalledExactlyOnceWith({ summary: true, page: 1, page_size: 20 })
  const [latest, older] = root.querySelectorAll('tbody tr')
  expect([...latest.cells].slice(0, 3).map(cell => cell.textContent)).toEqual(['2026年冬季赛', '12', '34'])
  expect([...older.cells].slice(0, 3).map(cell => cell.textContent)).toEqual(['2026年秋季赛', '0', '0'])
  latest.querySelectorAll('button')[0].click()
  older.querySelectorAll('button')[1].click()
  expect(push.mock.calls).toEqual([
    [{ path: '/event-add', query: { event_id: '42' } }],
    [{ path: '/score-import', query: { event_id: '89' } }],
  ])
})

it('keeps all three entry actions available in an empty list', async () => {
  getList.mockResolvedValue({ items: [], total: 0 })
  mount()
  await vi.waitFor(() => expect(root.textContent).toContain('暂无赛事'))
  for (const title of ['创建赛事', '进入向导', '积分规则配置']) button(title).click()
  expect(push.mock.calls).toEqual([['/event-add'], ['/work-wizard'], ['/scoring-rules']])
})

it('retries a failed or malformed data request and paginates at the server', async () => {
  getList.mockResolvedValueOnce({ items: [{ id: 7 }], total: 21 })
    .mockResolvedValueOnce({ items: Array.from({ length: 20 }, (_, i) => event(i + 1, 2050 - i, '春季赛')), total: 21 })
    .mockResolvedValueOnce({ items: [event(21, 2029, '春季赛', 11, 3)], total: 21 })
  mount()
  await vi.waitFor(() => expect(root.querySelector('[role=alert]')?.textContent).toContain('响应不完整'))
  button('重试').click()
  await vi.waitFor(() => expect(root.querySelectorAll('tbody tr')).toHaveLength(20))
  button('下一页').click()
  await vi.waitFor(() => expect(root.textContent).toContain('2029年春季赛'))
  expect(button('下一页').disabled).toBe(true)
  expect(getList).toHaveBeenLastCalledWith({ summary: true, page: 2, page_size: 20 })
})

const confirmButton = () => document.querySelector('[data-test=confirm-action]')
async function enterName(value) {
  const input = document.querySelector('[data-test=delete-name-input]')
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

it('requires an exact copyable name, prevents duplicate deletion, and refreshes on success', async () => {
  const kept = event(43, 2026, '秋季赛', 5, 9)
  getList.mockResolvedValueOnce({ total: 2, items: [event(42, 2026, '冬季赛', 12, 34), kept] })
    .mockResolvedValueOnce({ total: 1, items: [kept] })
  let resolveDelete
  deleteEvent.mockImplementation(() => new Promise(resolve => { resolveDelete = resolve }))
  mount()
  const opener = await vi.waitFor(() => {
    const node = root.querySelector('[aria-label="删除2026年冬季赛"]')
    expect(node).not.toBeNull()
    return node
  })
  opener.click()
  await nextTick()
  const dialog = document.querySelector('[role=dialog]')
  expect(dialog.textContent).toContain('将同步清理对应的报名信息、成绩和赛事配置')
  expect(dialog.textContent).toContain('是否确定要删除「2026年冬季赛」')
  const name = dialog.querySelector('[data-test=delete-event-name]').textContent
  expect(name).toBe('2026年冬季赛')
  expect(confirmButton().disabled).toBe(true)
  const cancel = dialog.querySelector('[data-test=cancel-action]')
  await vi.waitFor(() => expect(document.activeElement).toBe(cancel))
  cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(dialog.querySelector('input'))
  await enterName('2026年秋季赛')
  expect(confirmButton().disabled).toBe(true)
  await enterName(name + ' ')
  expect(confirmButton().disabled).toBe(true)
  confirmButton().click()
  expect(deleteEvent).not.toHaveBeenCalled()
  await enterName(name)
  expect(confirmButton().disabled).toBe(false)
  confirmButton().click()
  confirmButton().click()
  expect(deleteEvent).toHaveBeenCalledExactlyOnceWith(42, name)
  await nextTick()
  expect(document.querySelector('[data-test=cancel-action]').disabled).toBe(true)
  expect(dialog.querySelector('input').disabled).toBe(true)
  resolveDelete()
  await vi.waitFor(() => expect(root.querySelector('tbody')?.textContent).not.toContain('2026年冬季赛'))
  expect(root.querySelector('tbody').textContent).toContain('2026年秋季赛')
  expect(root.textContent).toContain('已删除「2026年冬季赛」')
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(document.activeElement).toBe(button('创建赛事'))
  expect(getList).toHaveBeenCalledTimes(2)
})

it('keeps the row and typed name on failure, and cancellation resets the draft', async () => {
  getList.mockResolvedValue({ total: 1, items: [event(42, 2026, '冬季赛')] })
  deleteEvent.mockRejectedValue({ detail: '赛事暂时无法删除' })
  mount()
  const opener = await vi.waitFor(() => {
    const node = button('删除')
    expect(node).toBeDefined()
    return node
  })
  opener.click()
  await nextTick()
  await enterName('2026年冬季赛')
  confirmButton().click()
  await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toBe('赛事暂时无法删除'))
  expect(getList).toHaveBeenCalledOnce()
  expect(root.querySelector('tbody').textContent).toContain('2026年冬季赛')
  expect(confirmButton().disabled).toBe(false)
  document.querySelector('[data-test=cancel-action]').click()
  await nextTick()
  expect(document.activeElement).toBe(opener)
  opener.click()
  await nextTick()
  expect(confirmButton().disabled).toBe(true)
  expect(document.querySelector('[data-test=delete-name-input]').value).toBe('')
  expect(document.querySelector('[role=alert]')).toBeNull()
})

it('returns to the previous page when deleting the last event on the final page', async () => {
  const firstPage = Array.from({ length: 20 }, (_, i) => event(i + 1, 2050 - i, '春季赛'))
  getList.mockResolvedValueOnce({ items: firstPage, total: 21 })
    .mockResolvedValueOnce({ items: [event(21, 2029, '春季赛')], total: 21 })
    .mockResolvedValueOnce({ items: [], total: 20 })
    .mockResolvedValueOnce({ items: firstPage, total: 20 })
  deleteEvent.mockResolvedValue()
  mount()
  await vi.waitFor(() => expect(button('下一页')).toBeDefined())
  button('下一页').click()
  await vi.waitFor(() => expect(root.textContent).toContain('2029年春季赛'))
  button('删除').click()
  await nextTick()
  await enterName('2029年春季赛')
  confirmButton().click()
  await vi.waitFor(() => expect(root.querySelectorAll('tbody tr')).toHaveLength(20))
  expect(deleteEvent).toHaveBeenCalledExactlyOnceWith(21, '2029年春季赛')
  expect(getList.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 2, 1])
})

const header = Array.from({ length: 4 }, () => ['靶位号', '俱乐部', '姓名']).flat()
const positions = (first, second) => ['1A', '测试俱乐部', first, '1B', '测试俱乐部', second, '1C', null, null, '1D', null, null]
const gold = { key: 'gold', label: '金牌赛', target_counts: [1, 2] }
const pdf = () => new Blob(['%PDF-test'], { type: 'application/pdf' })
const dialog = () => document.querySelector('[role=dialog]')
const groups = () => [...dialog().querySelectorAll('[data-test=scorecard-group]')]
const action = (name, owner = dialog()) => [...owner.querySelectorAll('button')].find(node => node.textContent.trim() === name)
function workbook(first = '选手甲') {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['2024赛季 第一站 春季赛'], ['03.02比赛日站位表'], ['10米反曲弓男子组'], header, positions(first, '选手乙'), ['18米复合弓女子组'], header, positions('选手丙', '选手丁')]), '站位表')
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], '站位.xlsx')
}
async function openScorecards(season = '秋季赛') {
  const opener = await vi.waitFor(() => {
    const node = root.querySelector('[aria-label="生成2026年' + season + '记分纸"]')
    expect(node).not.toBeNull()
    return node
  })
  opener.click()
  await nextTick()
  expect(dialog().textContent).toContain('2026年' + season)
  await vi.waitFor(() => expect(dialog().querySelector('input[type=file]').disabled).toBe(false))
}
async function upload(file, expectedPlans) {
  const input = dialog().querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  if (expectedPlans != null) await vi.waitFor(() => {
    expect(eliminationRounds).toHaveBeenCalledTimes(expectedPlans)
    expect(groups()).toHaveLength(2)
    expect(input.disabled).toBe(false)
  })
}
async function closeScorecards() {
  action('关闭').click()
  await vi.waitFor(() => expect(dialog()).toBeNull())
}
function fill(group, start, end = start) {
  group.querySelectorAll('input').forEach((input, index) => {
    input.value = [start, end][index]
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function setupScorecards() {
  getList.mockResolvedValue({ items: [event(42, 2026, '冬季赛'), event(89, 2026, '秋季赛')], total: 2 })
  eliminationRounds.mockResolvedValue({ participant_count: 2, rounds: [gold] })
  const downloads = []
  const blobs = []
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(blob => 'blob:scorecard-' + blobs.push(blob)), revokeObjectURL: vi.fn(),
  }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download) })
  mount()
  return { downloads, blobs }
}

it('imports a station workbook once, generates ranking PDF, and packages all valid elimination PDFs without regenerating a single download', async () => {
  const { downloads, blobs } = setupScorecards()
  rankingScorecards.mockResolvedValue(pdf())
  eliminationScorecards.mockImplementation(async () => pdf())
  await openScorecards()
  expect(root.querySelectorAll('button[aria-label$=记分纸]')).toHaveLength(2)
  const footer = confirmButton().parentElement
  expect([...footer.querySelectorAll('button')].map(button => button.textContent.trim())).toEqual([
    '关闭', '生成排位记分纸', '生成淘汰赛手卡',
  ])
  expect(action('生成排位记分纸').disabled).toBe(true)
  expect(confirmButton().disabled).toBe(true)
  await upload(workbook(), 1)
  expect(eliminationRounds).toHaveBeenCalledExactlyOnceWith(89, 2, expect.any(AbortSignal))
  expect(action('生成排位记分纸').disabled).toBe(false)
  expect(dialog().textContent).toContain('排位记分纸 4 页')
  expect(dialog().textContent).toContain('当前赛事：2026年秋季赛')
  expect(dialog().textContent).not.toContain('2024赛季')
  expect(dialog().textContent).not.toContain('03.02比赛日')
  expect(groups().map(group => group.querySelector('h5').textContent)).toEqual(['10米反曲弓男子组 · 2 人', '18米复合弓女子组 · 2 人'])
  action('生成排位记分纸').click()
  await vi.waitFor(() => expect(downloads).toEqual(['2026年秋季赛_排位记分纸.pdf']))
  expect(rankingScorecards).toHaveBeenCalledExactlyOnceWith(89, { pages: expect.any(Array) }, expect.any(AbortSignal))
  const { pages } = rankingScorecards.mock.calls[0][1]
  expect(pages.map(page => page.round)).toEqual(['一', '二', '一', '二'])
  expect(pages.map(page => page.group)).toEqual(['10米反曲弓男子组', '10米反曲弓男子组', '18米复合弓女子组', '18米复合弓女子组'])
  fill(groups()[0], 5)
  fill(groups()[1], 20, 22)
  await nextTick()
  expect(confirmButton().disabled).toBe(true)
  expect(groups()[1].textContent).toContain('当前共 3 个')
  action('生成本组 PDF', groups()[0]).click()
  await vi.waitFor(() => expect(downloads[1]).toMatch(/10米反曲弓男子组.*[.]pdf$/))
  fill(groups()[1], 20, 21)
  await nextTick()
  expect(confirmButton().disabled).toBe(false)
  confirmButton().click()
  await vi.waitFor(() => expect(downloads[2]).toBe('2026年秋季赛_淘汰赛手卡.zip'))
  expect(eliminationScorecards.mock.calls.map(([id, data]) => [id, data.bow_type, data.distance, data.gender_group, data.ranges])).toEqual([
    [89, 'recurve', '10m', 'men', { gold: [5, 5] }], [89, 'compound', '18m', 'women', { gold: [20, 21] }],
  ])
  expect(blobs.at(-1).type).toBe('application/zip')
  expect(dialog().querySelector('a[download$=".zip"]')?.textContent).toBe('下载全部 ZIP')
  expect(push).not.toHaveBeenCalled()
})

it('retains drafts on reopening and clears only the changed roster on reimport', async () => {
  setupScorecards()
  eliminationScorecards.mockResolvedValue(pdf())
  await openScorecards()
  await upload(workbook(), 1)
  fill(groups()[0], 5)
  fill(groups()[1], 20, 21)
  await nextTick()
  action('生成本组 PDF', groups()[1]).click()
  await vi.waitFor(() => expect(groups()[1].querySelector('a')).not.toBeNull())
  await closeScorecards()
  await openScorecards('冬季赛')
  expect(groups()).toHaveLength(0)
  expect(action('生成排位记分纸').disabled).toBe(true)
  await closeScorecards()
  await openScorecards()
  expect(dialog().textContent).toContain('已导入：站位.xlsx')
  expect([...groups()[0].querySelectorAll('input')].map(input => input.value)).toEqual(['5', '5'])
  await upload(workbook(), 2)
  expect([...groups()[0].querySelectorAll('input')].map(input => input.value)).toEqual(['5', '5'])
  await upload(workbook('另一位选手'), 3)
  expect([...groups()[0].querySelectorAll('input')].map(input => input.value)).toEqual(['', ''])
  expect([...groups()[1].querySelectorAll('input')].map(input => input.value)).toEqual(['20', '21'])
  expect(groups()[1].querySelector('a').textContent).toBe('下载 PDF')
  expect(confirmButton().disabled).toBe(true)
  await upload(new File(['invalid'], '坏表.xlsx'))
  await vi.waitFor(() => expect(dialog().querySelector('[role=alert]')).not.toBeNull())
  expect(groups()).toHaveLength(2)
  expect(action('生成排位记分纸').disabled).toBe(false)
})

it('restores the uploaded File and parsed configuration after a fresh page mount', async () => {
  setupScorecards()
  await openScorecards()
  const file = workbook()
  await upload(file, 1)
  expect(drafts.get(89).workbook.file).toBe(file)
  expect(drafts.get(89).workbook.pages).toHaveLength(4)
  fill(groups()[0], 24, 25)
  fill(groups()[1], 74, '')
  await vi.waitFor(() => expect(drafts.get(89).configuration.groups[1].ranges.gold).toEqual([74, '']))
  expect(saveWorkbook).toHaveBeenCalledOnce()
  app.unmount()
  root.remove()
  mount()
  await openScorecards('冬季赛')
  expect(groups()).toHaveLength(0)
  await closeScorecards()
  await openScorecards()
  expect(action('生成排位记分纸').disabled).toBe(false)
  expect(dialog().textContent).toContain('已导入：站位.xlsx')
  expect([...groups()[0].querySelectorAll('input')].map(input => input.value)).toEqual(['24', '25'])
  expect([...groups()[1].querySelectorAll('input')].map(input => input.value)).toEqual(['74', ''])
  expect(eliminationRounds).toHaveBeenCalledTimes(1)
  expect(deleteDraft).not.toHaveBeenCalled()
  await closeScorecards()
  deleteEvent.mockResolvedValue()
  root.querySelector('[aria-label="删除2026年秋季赛"]').click()
  await nextTick()
  await enterName('2026年秋季赛')
  confirmButton().click()
  await vi.waitFor(() => expect(deleteDraft).toHaveBeenCalledExactlyOnceWith(89))
  expect(drafts.has(89)).toBe(false)
})

it('keeps the workbook usable and warns when browser storage is unavailable', async () => {
  loadDraft.mockRejectedValue(new Error('Blocked'))
  saveWorkbook.mockRejectedValue(new Error('Quota exceeded'))
  setupScorecards()
  await openScorecards()
  expect(dialog().textContent).toContain('无法读取本地草稿')
  await upload(workbook(), 1)
  expect(dialog().textContent).toContain('刷新可能丢失当前修改')
  expect(action('生成排位记分纸').disabled).toBe(false)
})
