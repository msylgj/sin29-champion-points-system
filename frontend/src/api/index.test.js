import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NOW = 2_000_000_000
const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = payload => [encode({ alg: 'HS256' }), encode({ sub: 'admin', exp: NOW + 600, ...payload }), encode('signature')].join('.')
let api
let auth
let client
let AxiosError
let coordinator

function rejectWith(status, data = { detail: '请求失败' }) {
  client.defaults.adapter = config => Promise.reject(new AxiosError('failed', 'ERR_BAD_RESPONSE', config, {}, {
    config, status, data, statusText: 'failed', headers: {},
  }))
}

function delayedRequest() {
  let config
  let reject
  client.defaults.adapter = current => {
    config = current
    return new Promise((_resolve, rejectRequest) => { reject = rejectRequest })
  }
  return {
    waitForRequest: async () => { await vi.waitFor(() => expect(config).toBeTruthy()) },
    reject: () => reject(new AxiosError('unauthorized', 'ERR_BAD_RESPONSE', config, {}, {
      config, status: 401, data: { detail: '凭证失效' }, statusText: 'Unauthorized', headers: {},
    })),
  }
}

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const axiosModule = await import('axios')
  AxiosError = axiosModule.AxiosError
  const create = vi.spyOn(axiosModule.default, 'create')
  api = await import('./index.js')
  client = create.mock.results.at(-1).value
  client.defaults.adapter = config => Promise.resolve({ config, status: 200, data: { ok: true }, statusText: 'OK', headers: {} })
  auth = await import('../utils/adminAuth.js')
  coordinator = {
    currentRoute: { value: { path: '/scoring-rules', fullPath: '/scoring-rules?version=2#config' } },
    replace: vi.fn(async path => { coordinator.currentRoute.value = { path, fullPath: path } }),
  }
  auth.registerAdminAuthRouter(coordinator)
})
afterEach(() => vi.restoreAllMocks())

describe('actual axios request/response interceptor chain', () => {
  it('attaches only a usable token and records the request session and originating fullPath', async () => {
    const token = jwt()
    auth.saveAdminToken(token)
    const adapter = vi.fn(async config => ({ config, status: 200, data: { ok: true }, statusText: 'OK', headers: {} }))
    client.defaults.adapter = adapter
    await expect(api.scoringRuleAPI.getList()).resolves.toEqual({ ok: true })
    const config = adapter.mock.calls[0][0]
    expect(config.headers.Authorization).toBe('Bearer ' + token)
    expect(config.adminSessionSnapshot).toMatchObject({ token })
    expect(config.adminAuthRedirect).toBe('/scoring-rules?version=2#config')
    expect(config.adminAuthProtected).toBe(true)
  })

  it('removes expired credentials from reused default headers without forcing public visitors to authenticate', async () => {
    localStorage.setItem('admin_auth_token', jwt({ exp: NOW }))
    client.defaults.headers.common.Authorization = 'Bearer stale-default'
    const adapter = vi.fn(async config => ({ config, status: 200, data: { items: [] }, statusText: 'OK', headers: {} }))
    client.defaults.adapter = adapter
    await api.eventAPI.getYears()
    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(auth.adminAuthRequest.value).toBeNull()
  })

  it('uses the fixed rule API endpoints and preserves status opt-in', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({})
    const post = vi.spyOn(client, 'post').mockResolvedValue({})
    const remove = vi.spyOn(client, 'delete').mockResolvedValue({})
    const payload = { name: '新规则', base_rule_id: 2, previous_end_event_id: 10, config: { precision: 1, rounding: 'half_up' } }
    await api.scoringRuleAPI.getList()
    await api.scoringRuleAPI.create(payload)
    await api.scoringRuleAPI.delete(42)
    expect(get).toHaveBeenCalledWith('/scoring-rules', { preserveStatus: true })
    expect(post).toHaveBeenCalledWith('/scoring-rules', payload, { preserveStatus: true })
    expect(remove).toHaveBeenCalledWith('/scoring-rules/42', { preserveStatus: true })
  })

  it.each([400, 404, 409])('preserves deletion status %s and details only for rule-version calls', async status => {
    rejectWith(status, { detail: '删除规则被拒绝' })
    await expect(api.scoringRuleAPI.delete(42)).rejects.toEqual({ status, detail: '删除规则被拒绝' })
    await expect(api.scoreAPI.delete(42)).rejects.toEqual({ detail: '删除规则被拒绝' })
  })

  it('clears a rejected current session and replaces to home, retaining the exact management target', async () => {
    auth.saveAdminToken(jwt())
    rejectWith(401, { detail: '凭证失效' })
    await expect(api.scoringRuleAPI.getList()).rejects.toEqual({ status: 401, detail: '凭证失效' })
    await vi.waitFor(() => expect(coordinator.replace).toHaveBeenCalledExactlyOnceWith('/points-display'))
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
    expect(sessionStorage.getItem('admin_auth_redirect')).toBe('/scoring-rules?version=2#config')
  })

  it('recovers protected no-token 401s too', async () => {
    rejectWith(401)
    await expect(api.eventAPI.getList()).rejects.toEqual({ detail: '请求失败' })
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
    await vi.waitFor(() => expect(coordinator.replace).toHaveBeenCalledTimes(1))
  })

  it('coalesces concurrent 401s from different protected resources without replacing the first target', async () => {
    auth.saveAdminToken(jwt())
    rejectWith(401)
    await Promise.allSettled([api.scoringRuleAPI.getList(), api.eventAPI.getList(), api.scoreAPI.getList()])
    await vi.waitFor(() => expect(coordinator.replace).toHaveBeenCalledTimes(1))
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
  })

  it.each([false, true])('ignores a late 401 after successful login (same token: %s)', async sameToken => {
    const old = jwt()
    auth.saveAdminToken(old)
    const delayed = delayedRequest()
    const result = api.scoringRuleAPI.getList().catch(error => error)
    await delayed.waitForRequest()
    const next = sameToken ? old : jwt({ exp: NOW + 1000 })
    auth.saveAdminToken(next)
    delayed.reject()
    expect(await result).toEqual({ status: 401, detail: '凭证失效' })
    expect(auth.getValidAdminToken()).toBe(next)
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(coordinator.replace).not.toHaveBeenCalled()
  })

  it('ignores a late no-token 401 after login', async () => {
    const delayed = delayedRequest()
    const result = api.eventAPI.getList().catch(error => error)
    await delayed.waitForRequest()
    auth.saveAdminToken(jwt())
    delayed.reject()
    await result
    expect(auth.getValidAdminToken()).not.toBeNull()
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(coordinator.replace).not.toHaveBeenCalled()
  })

  it('still recovers when a public request cleared expiry before the private 401 arrived', async () => {
    auth.saveAdminToken(jwt({ exp: NOW + 1 }))
    const delayed = delayedRequest()
    const result = api.scoringRuleAPI.getList().catch(error => error)
    await delayed.waitForRequest()
    vi.mocked(Date.now).mockReturnValue((NOW + 2) * 1000)
    client.defaults.adapter = config => Promise.resolve({ config, status: 200, data: {}, statusText: 'OK', headers: {} })
    await api.eventAPI.getYears()
    expect(auth.getValidAdminToken()).toBeNull()
    delayed.reject()
    await result
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
    await vi.waitFor(() => expect(coordinator.replace).toHaveBeenCalledTimes(1))
  })

  it('publishes same-page reauthentication without reloading an already mounted home', async () => {
    coordinator.currentRoute.value = { path: '/points-display', fullPath: '/points-display' }
    rejectWith(401)
    await api.scoringRuleAPI.getList().catch(() => {})
    expect(auth.adminAuthRequest.value.redirect).toBe('/event-list')
    expect(coordinator.replace).not.toHaveBeenCalled()
  })

  it('does not globally recover from bad-password 401, preserving token and pending dialog', async () => {
    auth.saveAdminToken(jwt())
    coordinator.currentRoute.value = { path: '/points-display', fullPath: '/points-display' }
    await auth.requestAdminAuthentication('/scoring-rules')
    const request = auth.adminAuthRequest.value
    rejectWith(401, { detail: '口令错误' })
    await expect(api.authAPI.login('wrong')).rejects.toEqual({ detail: '口令错误' })
    expect(auth.getValidAdminToken()).not.toBeNull()
    expect(auth.adminAuthRequest.value).toBe(request)
    expect(coordinator.replace).not.toHaveBeenCalled()
  })

  it.each(['years', 'dictionary', 'ranking'])('does not recover from public %s endpoint 401', async kind => {
    const token = jwt()
    auth.saveAdminToken(token)
    rejectWith(401)
    const promise = kind === 'years' ? api.eventAPI.getYears() : kind === 'dictionary' ? api.dictionaryAPI.getAll() : api.scoreAPI.getAnnualRanking(2026, 'recurve')
    await expect(promise).rejects.toEqual({ detail: '请求失败' })
    expect(auth.getValidAdminToken()).toBe(token)
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(coordinator.replace).not.toHaveBeenCalled()
  })

  it.each([403, 500, 'network'])('does not treat %s as invalid authentication', async status => {
    const token = jwt()
    auth.saveAdminToken(token)
    if (status === 'network') client.defaults.adapter = config => Promise.reject(new AxiosError('offline', 'ERR_NETWORK', config))
    else rejectWith(status)
    await api.scoringRuleAPI.getList().catch(() => {})
    expect(auth.getValidAdminToken()).toBe(token)
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(coordinator.replace).not.toHaveBeenCalled()
  })
})
