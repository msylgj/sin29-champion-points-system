import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import EventList from './EventList.vue'

const { push, getList, deleteEvent } = vi.hoisted(() => ({ push: vi.fn(), getList: vi.fn(), deleteEvent: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api', () => ({ eventAPI: { getList, delete: deleteEvent } }))
let app
let root
const button = title => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === title)
const event = (id, year, season, registration_count = 0, score_count = 0) => ({ id, year, season, registration_count, score_count })
function mount() {
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(EventList)
  app.mount(root)
}
beforeEach(() => { getList.mockReset(); push.mockReset(); deleteEvent.mockReset() })
afterEach(() => { app?.unmount(); root?.remove() })

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
