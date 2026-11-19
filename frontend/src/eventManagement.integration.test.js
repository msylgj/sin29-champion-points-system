import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'
import App from './App.vue'
import router from './router'
import { clearAdminAuthRequest } from '@/utils/adminAuth'

let app
let root
const originalAdapter = axios.defaults.adapter
const ready = selector => vi.waitFor(() => {
  const node = root.querySelector(selector)
  expect(node).not.toBeNull()
  expect(node.disabled).not.toBe(true)
  return node
})
const change = (node, value, event = 'input') => {
  node.value = value
  node.dispatchEvent(new Event(event, { bubbles: true }))
}
const pathIs = path => vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(path))
afterEach(() => {
  app?.unmount()
  root?.remove()
  router.options.history.destroy()
  axios.defaults.adapter = originalAdapter
  clearAdminAuthRequest()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

it('opens the authenticated list, binds both forms, and refreshes counts after import', async () => {
  const events = [{ id: 29, year: 2026, season: '冬季赛' }, { id: 10, year: 2025, season: '春季赛' }]
  let registrations = [{ id: 44, name: '测试选手', year: 2025, season: '春季赛', competition_bow_type: 'barebow', points_bow_type: 'barebow', distance: '30m', competition_gender_group: 'men' }]
  const config = { id: 31, event_id: 29, bow_type: 'barebow', distance: '30m', gender_group: 'men', team_count: 1, individual_participant_count: 0, mixed_doubles_team_count: 0 }
  let scores = []
  const writes = []
  const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const token = [encode({ alg: 'HS256' }), encode({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }), 'c2ln'].join('.')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  axios.defaults.adapter = async request => {
    const { url, params = {}, method } = request
    const response = data => ({ data, status: 200, statusText: 'OK', headers: {}, config: request })
    if (url === '/auth/login') return response({ access_token: token })
    if (url === '/events/years') return response({ items: [2026, 2025] })
    if (url.startsWith('/scores/annual-ranking/')) return response({ items: [] })
    if (url === '/dictionaries') return response({ data: {
      bowTypes: [{ code: 'barebow', name: '光弓' }], distances: [{ code: '30m', name: '30米' }],
      competitionFormats: [{ code: 'ranking', name: '排位赛' }, { code: 'team', name: '团体赛' }],
      competitionGenderGroups: [{ code: 'men', name: '男子组' }, { code: 'mixed', name: '混合组' }],
      competitionGroups: [{ bow_type: 'barebow', distance: '30m', group_code: 'A' }],
    } })
    if (url === '/events' && params.summary) {
      expect(request.headers.Authorization).toBe('Bearer ' + token)
      return response({ items: events.map(event => ({ ...event, registration_count: Number(event.id === 10), score_count: scores.filter(row => row.event_id === event.id).length })), total: events.length })
    }
    const event = events.find(event => url === '/events/' + event.id)
    if (event && method === 'delete') {
      expect(request.headers.Authorization).toBe('Bearer ' + token)
      expect(JSON.parse(request.data)).toEqual({ confirmation_name: '2025年春季赛' })
      expect(event.id).toBe(10)
      registrations = registrations.filter(row => row.year !== event.year || row.season !== event.season)
      scores = scores.filter(row => row.event_id !== event.id)
      events.splice(events.indexOf(event), 1)
      return { ...response(''), status: 204 }
    }
    if (event) return response({ ...event, configurations: event.id === 29 ? [{ ...config }] : [] })
    if (url === '/event-registrations') {
      const items = registrations.filter(row => row.year === params.year && row.season === params.season)
      return response({ items, total: items.length })
    }
    if (url === '/scores') {
      const items = scores.filter(row => row.event_id === params.event_id)
      return response({ items, total: items.length })
    }
    if (url === '/event-configurations/31' && method === 'put') {
      writes.push({ url, ...JSON.parse(request.data) })
      return response(Object.assign(config, JSON.parse(request.data)))
    }
    if (url === '/scores/batch/import' && method === 'post') {
      scores = JSON.parse(request.data).scores.map((row, index) => ({ ...row, id: index + 1 }))
      return response(scores)
    }
    if (url === '/scoring-rules') return response({ items: [] })
    throw new Error('Unexpected management request: ' + method + ' ' + url)
  }

  await router.push('/points-display')
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(App).use(router)
  app.mount(root)
  ;(await ready('.btn-manage')).click()
  change(await ready('.auth-input'), 'fixture-password')
  ;(await ready('.btn-auth-submit')).click()
  await pathIs('/event-list')
  ;(await ready('tbody tr:first-child button:first-child')).click()
  await pathIs('/event-add?event_id=29')
  await vi.waitFor(() => expect(root.querySelector('#season')?.value).toBe('冬季赛'))
  expect(root.querySelector('#season').disabled).toBe(true)
  change(await ready('[data-test=configuration-section] .table-input'), '2')
  ;(await ready('[data-test=event-submit]')).click()
  await pathIs('/event-list')
  expect(writes).toEqual([expect.objectContaining({ url: '/event-configurations/31', team_count: 2 })])

  ;(await ready('tbody tr:last-child button:nth-child(2)')).click()
  await pathIs('/score-import?event_id=10')
  expect((await ready('[data-test=managed-locked-event]')).textContent).toContain('2025 春季赛')
  const fileInput = await ready('input[type=file]')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['姓名', '弓种', '距离', '赛制', '排名'], ['测试选手', '光弓', '30m', '排位赛', 1]]), '成绩')
  Object.defineProperty(fileInput, 'files', { value: [new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], '成绩.xlsx')] })
  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
  ;(await ready('.btn-submit')).click()
  await pathIs('/event-list')
  expect(scores).toEqual([expect.objectContaining({ event_id: 10, name: '测试选手', gender_group: 'men', rank: 1 })])
  await vi.waitFor(() => expect([...root.querySelectorAll('tbody tr:last-child td')].slice(0, 2).map(cell => cell.textContent)).toEqual(['1', '1']))

  await router.push('/score-import?event_id=10')
  const beforeSwitch = await ready('[data-test=managed-locked-event]')
  expect(beforeSwitch.textContent).toContain('2025 春季赛')
  await router.push('/score-import?event_id=29')
  const afterSwitch = await ready('[data-test=managed-locked-event]')
  expect(afterSwitch).not.toBe(beforeSwitch)
  expect(afterSwitch.textContent).toContain('2026 冬季赛')
  ;(await ready('[data-test=score-complete]')).click()
  await pathIs('/event-list')

  ;(await ready('.list-actions button:last-child')).click()
  await pathIs('/scoring-rules')
  ;(await ready('.btn-back')).click()
  await pathIs('/event-list')
  ;(await ready('[aria-label="删除2025年春季赛"]')).click()
  await vi.waitFor(() => expect(document.querySelector('[data-test=confirm-action]')?.disabled).toBe(true))
  change(document.querySelector('[data-test=delete-name-input]'), '2025年春季赛')
  await vi.waitFor(() => expect(document.querySelector('[data-test=confirm-action]').disabled).toBe(false))
  document.querySelector('[data-test=confirm-action]').click()
  await vi.waitFor(() => expect(root.querySelector('tbody')?.textContent).toContain('2026年冬季赛'))
  await vi.waitFor(() => expect(root.querySelector('tbody')?.textContent).not.toContain('2025年春季赛'))
  expect(scores).toHaveLength(0)
  expect(registrations).toHaveLength(0)
})
