import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NOW = 2_000_000_000
const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (payload = {}, header = { alg: 'HS256', typ: 'JWT' }) =>
  [encode(header), encode({ sub: 'admin', exp: NOW + 600, ...payload }), encode('test-signature')].join('.')
let auth

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  sessionStorage.clear()
  vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000)
  auth = await import('./adminAuth.js')
})
afterEach(() => vi.restoreAllMocks())

describe('valid administrator JWT UX checks', () => {
  it('accepts a well-formed future administrator JWT but does not claim signature verification', () => {
    const token = jwt()
    localStorage.setItem('admin_auth_token', token)
    expect(auth.getValidAdminToken()).toBe(token)
    expect(auth.adminAuthRequest.value).toBeNull()
  })

  it.each([
    'valid-token', '', 'a.b.c', jwt({ exp: NOW }), jwt({ exp: NOW - 1 }), jwt({ exp: null }),
    jwt({ exp: '9999999999' }), jwt({ exp: false }), jwt({ sub: 'reader' }), jwt({ nbf: NOW + 1 }),
    jwt({ nbf: '1' }), jwt({ nbf: null }), jwt({ nbf: false }), jwt({}, { alg: 'none' }), jwt({}, {}),
  ])('clears unusable token without requiring public visitors to authenticate (%s)', token => {
    localStorage.setItem('admin_auth_token', token)
    expect(auth.getValidAdminToken()).toBeNull()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(sessionStorage.getItem('admin_auth_required')).toBeNull()
  })

  it.each(['{"sub":"admin"}', '{"sub":"admin","exp":1e999}', '{"sub":"admin","exp":9999999999,"nbf":1e999}', '[]', 'null'])('rejects missing/nonfinite time claims and non-object payload: %s', payload => {
    const token = [encode({ alg: 'HS256' }), btoa(payload).replace(/=/g, ''), encode('signature')].join('.')
    localStorage.setItem('admin_auth_token', token)
    expect(auth.getValidAdminToken()).toBeNull()
  })

  it('allows nbf exactly now and exp a fraction into the future', () => {
    const token = jwt({ nbf: NOW, exp: NOW + 0.5 })
    auth.saveAdminToken(token)
    expect(auth.getValidAdminToken()).toBe(token)
  })

  it('rejects an invalid successful-login token without discarding an existing valid session/request', async () => {
    const good = jwt()
    auth.saveAdminToken(good)
    await auth.requestAdminAuthentication('/scoring-rules')
    expect(() => auth.saveAdminToken('bad')).toThrow(new Error('管理员凭证无效或已过期，请重新验证口令'))
    expect(auth.getValidAdminToken()).toBe(good)
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules')
  })
})

describe('safe fullPath redirects', () => {
  it.each(['/event-add', '/score-import?year=2026#scores', '/scoring-rules?version=2#config'])('preserves permitted path/query/hash %s', target => {
    expect(auth.sanitizeAdminRedirect(target)).toBe(target)
  })

  it.each([
    null, undefined, 3, '', 'https://evil.test/score-import', '//evil.test/scoring-rules', 'javascript:alert(1)',
    '/event-add/extra', '/event-add-other', '/points-display', '/scoring-rules/', '/%73coring-rules',
    '/%2f%2fevil.test', '/event-add/../scoring-rules', '/score-import%3fnext=1', '/score-import\\evil',
    '/\\evil.test', '/scoring-rules\n?x=1', ' /scoring-rules',
  ])('rejects external/unrecognized/encoded paths %s', target => {
    expect(auth.sanitizeAdminRedirect(target)).toBe('/score-import')
  })
})

describe('reactive and persisted authentication recovery', () => {
  it('restores an old pending marker immediately on module initialization', async () => {
    sessionStorage.setItem('admin_auth_required', '1')
    sessionStorage.setItem('admin_auth_redirect', '/scoring-rules?version=2#config')
    vi.resetModules()
    const restored = await import('./adminAuth.js')
    expect(restored.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
  })

  it('sanitizes an untrusted persisted target', async () => {
    sessionStorage.setItem('admin_auth_required', '1')
    sessionStorage.setItem('admin_auth_redirect', '//evil.test')
    vi.resetModules()
    const restored = await import('./adminAuth.js')
    expect(restored.adminAuthRequest.value.redirect).toBe('/score-import')
  })

  it('publishes without a registered router and clears both old marker keys on cancel', async () => {
    await auth.requestAdminAuthentication('/event-add?year=2026#config')
    expect(auth.adminAuthRequest.value.redirect).toBe('/event-add?year=2026#config')
    expect(sessionStorage.getItem('admin_auth_required')).toBe('1')
    auth.clearAdminAuthRequest()
    expect(auth.adminAuthRequest.value).toBeNull()
    expect(sessionStorage.getItem('admin_auth_required')).toBeNull()
    expect(sessionStorage.getItem('admin_auth_redirect')).toBeNull()
  })

  it('only replaces home once and preserves the first management target', async () => {
    const router = { currentRoute: { value: { path: '/scoring-rules', fullPath: '/scoring-rules?version=2#config' } }, replace: vi.fn() }
    auth.registerAdminAuthRouter(router)
    const one = auth.requestAdminAuthentication('/scoring-rules?version=2#config')
    const two = auth.requestAdminAuthentication('/event-add')
    await Promise.all([one, two])
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/points-display')
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#config')
    expect(sessionStorage.getItem('admin_auth_redirect')).toBe('/scoring-rules?version=2#config')
  })

  it('notifies a mounted public home without a redundant replace', async () => {
    const router = { currentRoute: { value: { path: '/points-display' } }, replace: vi.fn() }
    auth.registerAdminAuthRouter(router)
    await auth.requestAdminAuthentication('/event-add')
    expect(auth.adminAuthRequest.value.redirect).toBe('/event-add')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('does not run queued recovery navigation after successful authentication clears it', async () => {
    const router = { currentRoute: { value: { path: '/scoring-rules' } }, replace: vi.fn() }
    auth.registerAdminAuthRouter(router)
    const pending = auth.requestAdminAuthentication('/scoring-rules')
    auth.saveAdminToken(jwt())
    await pending
    expect(router.replace).not.toHaveBeenCalled()
    expect(auth.adminAuthRequest.value).toBeNull()
  })
})

describe('401 session-generation races', () => {
  it.each([false, true])('ignores delayed 401 after a new login, even if JWT is identical (%s)', identical => {
    const token = jwt()
    auth.saveAdminToken(token)
    const original = auth.getAdminSessionSnapshot()
    const next = identical ? token : jwt({ exp: NOW + 900 })
    auth.saveAdminToken(next)
    expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
    expect(auth.getValidAdminToken()).toBe(next)
    expect(auth.adminAuthRequest.value).toBeNull()
  })

  it('does not let an old no-token request clear a newly saved token', () => {
    const original = auth.getAdminSessionSnapshot()
    auth.saveAdminToken(jwt())
    expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
    expect(auth.getValidAdminToken()).not.toBeNull()
  })

  it('coalesces a batch of no-token 401s and does not reopen after cancellation', () => {
    const original = auth.getAdminSessionSnapshot()
    expect(auth.recoverAdminUnauthorized(original, '/scoring-rules')).toBe(true)
    expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
    expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules')
    auth.clearAdminAuthRequest()
    expect(auth.recoverAdminUnauthorized(original, '/score-import')).toBe(false)
    expect(auth.adminAuthRequest.value).toBeNull()
  })

  it('recognizes an out-of-band replacement token before processing a late 401', () => {
    auth.saveAdminToken(jwt())
    const original = auth.getAdminSessionSnapshot()
    const newer = jwt({ exp: NOW + 1200 })
    localStorage.setItem('admin_auth_token', newer)
    expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
    expect(auth.getValidAdminToken()).toBe(newer)
  })
})

it('recovers the same expired session if a public getter cleared its token before private 401 arrived', () => {
  auth.saveAdminToken(jwt({ exp: NOW + 1 }))
  const original = auth.getAdminSessionSnapshot()
  vi.mocked(Date.now).mockReturnValue((NOW + 2) * 1000)
  expect(auth.getValidAdminToken()).toBeNull()
  expect(auth.adminAuthRequest.value).toBeNull()
  expect(auth.recoverAdminUnauthorized(original, '/scoring-rules?version=2')).toBe(true)
  expect(auth.adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2')
  auth.clearAdminAuthRequest()
  expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
})

it('does not resurrect a discarded session after a later login and later expiry', () => {
  const token = jwt({ exp: NOW + 1 })
  auth.saveAdminToken(token)
  const original = auth.getAdminSessionSnapshot()
  vi.mocked(Date.now).mockReturnValue((NOW + 2) * 1000)
  auth.getValidAdminToken()
  const newer = jwt({ exp: NOW + 10 })
  auth.saveAdminToken(newer)
  vi.mocked(Date.now).mockReturnValue((NOW + 20) * 1000)
  auth.getValidAdminToken()
  expect(auth.recoverAdminUnauthorized(original, '/event-add')).toBe(false)
  expect(auth.adminAuthRequest.value).toBeNull()
})
