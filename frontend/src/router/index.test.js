import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import router from './index'

describe('router admin guard', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'scrollTo', {
      value: () => {},
      writable: true,
      configurable: true,
    })
    localStorage.clear()
    sessionStorage.clear()
    await router.push('/points-display')
    await router.isReady()
  })

  afterEach(async () => {
    await router.push('/points-display')
  })

  it('redirects unauthenticated access to score import', async () => {
    await router.push('/score-import')

    expect(router.currentRoute.value.fullPath).toBe('/points-display')
    expect(sessionStorage.getItem('admin_auth_required')).toBe('1')
    expect(sessionStorage.getItem('admin_auth_redirect')).toBe('/score-import')
  })

  it('allows authenticated access to score import', async () => {
    localStorage.setItem('admin_auth_token', 'valid-token')

    await router.push('/score-import')

    expect(router.currentRoute.value.fullPath).toBe('/score-import')
  })
})