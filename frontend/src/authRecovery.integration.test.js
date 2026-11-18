import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import axios, { AxiosError } from 'axios'

let app
let router
let root
let originalAdapter
let clearPending
const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const token = exp => [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: 'admin', exp }), 'c2lnbmF0dXJl'].join('.')
const now = () => Math.floor(Date.now() / 1000)

afterEach(() => {
  app?.unmount()
  root?.remove()
  router?.options.history.destroy()
  if (originalAdapter) axios.defaults.adapter = originalAdapter
  clearPending?.()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

it('recovers an expired first refresh and a runtime 401 in one real-router/Axios flow without another refresh', async () => {
  const target = '/scoring-rules?version=2#config'
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('admin_auth_token', token(now() - 1))
  window.history.replaceState({}, '', target)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const requests = []
  let rejectNextRuleRead = false
  let loginCount = 0
  const configSnapshot = {
    ranking_points: [25], elimination_points: [45], team_points: [20],
    individual_coefficients: [{ min_count: 2, max_count: null, coefficient: 1, cutoff: 8 }],
    team_coefficients: [{ min_count: 2, max_count: null, coefficient: 1, cutoff: 8 }],
    group_multipliers: { S: 1, A: 1, B: 0.5, C: 0.3 }, competition_groups: [],
    fallback_base_points: 1, default_participant_count: 2, precision: 1, rounding: 'half_up',
  }
  originalAdapter = axios.defaults.adapter
  axios.defaults.adapter = async config => {
    requests.push({ url: config.url, method: config.method })
    const response = data => ({ data, status: 200, statusText: 'OK', headers: {}, config })
    const unauthorized = detail => {
      throw new AxiosError(detail, 'ERR_BAD_REQUEST', config, null, { ...response({ detail }), status: 401, statusText: 'Unauthorized' })
    }
    if (config.url === '/auth/login') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      if (body.password === 'wrong') return unauthorized('管理密码错误')
      loginCount += 1
      return response({ access_token: token(now() + 3600 + loginCount), token_type: 'bearer' })
    }
    if (config.url === '/scoring-rules') {
      if (rejectNextRuleRead) { rejectNextRuleRead = false; return unauthorized('认证无效') }
      return response({ items: [{ id: 1, name: '初始规则', source_rule_id: null, start: null, end: null, created_at: '2026-01-01', config: configSnapshot }] })
    }
    if (config.url === '/events/years') return response({ items: [2026] })
    if (config.url === '/events') return response({ items: [], total: 0 })
    if (config.url === '/dictionaries') return response({ data: {
      bowTypes: [{ code: 'recurve', name: '反曲弓' }], distances: [{ code: '30m', name: '30米' }],
      competitionFormats: [], competitionGenderGroups: [], competitionGroups: [],
    } })
    if (config.url.startsWith('/scores/annual-ranking/')) return response({ athletes: [] })
    throw new Error('Unexpected isolated-test request: ' + config.url)
  }

  router = (await import('./router')).default
  const { clearAdminAuthRequest } = await import('./utils/adminAuth')
  clearPending = clearAdminAuthRequest
  const { default: App } = await import('./App.vue')
  root = document.createElement('div')
  document.body.appendChild(root)
  app = createApp(App)
  app.use(router)
  app.mount(root)
  await router.isReady()
  await vi.waitFor(() => expect(root.querySelector('.auth-dialog')).not.toBeNull())
  expect(router.currentRoute.value.fullPath).toBe('/points-display')
  expect(requests.some(request => request.url === '/scoring-rules' || request.url === '/events')).toBe(false)
  expect(localStorage.getItem('admin_auth_token')).toBeNull()

  const login = async password => {
    const input = root.querySelector('.auth-input')
    input.value = password
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    root.querySelector('.btn-auth-submit').click()
  }
  await login('correct')
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(target))
  await vi.waitFor(() => expect(root.querySelector('[data-test=reload-rules]')?.disabled).toBe(false))
  expect(root.querySelector('.auth-dialog')).toBeNull()
  expect(sessionStorage.getItem('admin_auth_required')).toBeNull()

  let finishHomeNavigation
  const replace = router.replace
  vi.spyOn(router, 'replace').mockImplementationOnce(location => new Promise(resolve => {
    finishHomeNavigation = () => resolve(replace(location))
  }))
  rejectNextRuleRead = true
  root.querySelector('[data-test=reload-rules]').click()
  await vi.waitFor(() => expect(root.querySelector('.auth-redirecting')).not.toBeNull())
  expect(router.currentRoute.value.fullPath).toBe(target)
  expect(root.querySelector('.scoring-rules-page')).toBeNull()
  expect(root.querySelector('.auth-redirecting a').getAttribute('href')).toBe('/points-display')
  expect(root.querySelector('.auth-redirecting button').textContent).toBe('重试返回首页')
  finishHomeNavigation()
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/points-display'))
  await vi.waitFor(() => expect(root.querySelector('.auth-dialog')).not.toBeNull())
  expect(sessionStorage.getItem('admin_auth_redirect')).toBe(target)
  expect(localStorage.getItem('admin_auth_token')).toBeNull()
  expect(root.querySelector('.scoring-rules-page')).toBeNull()

  await login('wrong')
  await vi.waitFor(() => expect(root.querySelector('.auth-error')?.textContent).toBe('管理密码错误'))
  expect(router.currentRoute.value.fullPath).toBe('/points-display')
  expect(sessionStorage.getItem('admin_auth_redirect')).toBe(target)
  await login('correct-again')
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(target))
  await vi.waitFor(() => expect(root.querySelector('[data-test=reload-rules]')?.disabled).toBe(false))
  expect(root.querySelector('.auth-dialog')).toBeNull()
  expect(loginCount).toBe(2)
})
