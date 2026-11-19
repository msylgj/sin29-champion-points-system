import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NOW = 2_000_000_000
const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = payload => [encode({ alg: 'HS256' }), encode({ sub: 'admin', exp: NOW + 600, ...payload }), encode('signature')].join('.')
let router
let auth
let axiosModule
let axiosCreate

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/points-display')
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true, writable: true })
  vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000)
  axiosModule = await import('axios')
  axiosCreate = vi.spyOn(axiosModule.default, 'create')
  router = (await import('./index.js')).default
  auth = await import('../utils/adminAuth.js')
  await router.push('/points-display')
  await router.isReady()
})

afterEach(async () => {
  await router.push('/points-display')
  router.options.history.destroy()
  vi.restoreAllMocks()
})

describe('actual project router administrator guard', () => {
  it.each(['/event-add', '/score-import', '/scoring-rules', '/work-wizard', '/event-list'])('blocks %s before lazy management component resolution when token expired', async path => {
    localStorage.setItem('admin_auth_token', jwt({ exp: NOW - 1 }))
    const route = router.getRoutes().find(record => record.path === path)
    const lazy = vi.fn(route.components.default)
    route.components.default = lazy
    const target = path + '?year=2026#config'
    await router.push(target)
    expect(router.currentRoute.value.fullPath).toBe('/points-display')
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(auth.adminAuthRequest.value.redirect).toBe(target)
    expect(sessionStorage.getItem('admin_auth_required')).toBe('1')
    expect(sessionStorage.getItem('admin_auth_redirect')).toBe(target)
    expect(lazy).not.toHaveBeenCalled()
  })

  it.each(['/event-add', '/score-import', '/scoring-rules', '/work-wizard', '/event-list'])('blocks %s for a missing token', async path => {
    await router.push(path)
    expect(router.currentRoute.value.path).toBe('/points-display')
    expect(auth.adminAuthRequest.value.redirect).toBe(path)
  })

  it.each(['broken-jwt', jwt({ exp: null }), jwt({ nbf: NOW + 1 })])('rejects malformed/missing-exp/future-nbf JWT before management loads', async token => {
    localStorage.setItem('admin_auth_token', token)
    await router.push('/scoring-rules?version=2#config')
    expect(router.currentRoute.value.fullPath).toBe('/points-display')
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
  })

  it.each(['/event-add', '/score-import', '/scoring-rules', '/work-wizard', '/event-list'])('allows a future administrator JWT into %s', async path => {
    auth.saveAdminToken(jwt())
    await router.push(path + '?year=2026#config')
    expect(router.currentRoute.value.fullPath).toBe(path + '?year=2026#config')
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(router.resolve(path).meta.requiresAdminAuth).toBe(true)
  })

  it('sets the management title and uses replace rather than leaving a rejected private history entry', async () => {
    auth.saveAdminToken(jwt())
    await router.push('/scoring-rules')
    expect(document.title).toBe('积分规则管理')
    localStorage.removeItem('admin_auth_token')
    await router.push('/event-add')
    expect(router.currentRoute.value.path).toBe('/points-display')
    expect(document.title).toBe('积分排名')
    expect(router.options.history.location).toBe('/points-display')
  })

  it('does not force authentication on the public page when its token is expired', async () => {
    localStorage.setItem('admin_auth_token', jwt({ exp: NOW - 1 }))
    await router.push('/points-display?year=2026')
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(sessionStorage.getItem('admin_auth_required')).toBeNull()
  })

  it('restores a protected request target then returns after successful save', async () => {
    await router.push('/scoring-rules?version=2#config')
    const target = auth.adminAuthRequest.value.redirect
    auth.saveAdminToken(jwt())
    await router.push(target)
    expect(router.currentRoute.value.fullPath).toBe('/scoring-rules?version=2#config')
    expect(sessionStorage.getItem('admin_auth_required')).toBeNull()
  })

  it('runs real router plus real axios 401 recovery without a router/API import cycle', async () => {
    auth.saveAdminToken(jwt())
    await router.push('/scoring-rules?version=2#config')
    const api = await import('../api/index.js')
    const client = axiosCreate.mock.results.at(-1).value
    client.defaults.adapter = config => Promise.reject(new axiosModule.AxiosError('expired', 'ERR_BAD_RESPONSE', config, {}, {
      config, status: 401, data: { detail: '凭证失效' }, statusText: 'Unauthorized', headers: {},
    }))
    const replace = vi.spyOn(router, 'replace')
    await Promise.allSettled([api.scoringRuleAPI.getList(), api.eventAPI.getList()])
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/points-display'))
    expect(replace).toHaveBeenCalledExactlyOnceWith('/points-display')
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
    const saved = auth.adminAuthRequest.value
    await api.authAPI.login('wrong').catch(() => {})
    expect(auth.adminAuthRequest.value).toBe(saved)
    expect(replace).toHaveBeenCalledTimes(1)
    auth.saveAdminToken(jwt({ exp: NOW + 1000 }))
    await router.push(saved.redirect)
    expect(router.currentRoute.value.fullPath).toBe('/scoring-rules?version=2#config')
  })
})
