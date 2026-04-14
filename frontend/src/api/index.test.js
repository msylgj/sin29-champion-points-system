import { beforeEach, describe, expect, it, vi } from 'vitest'

const interceptors = {
  request: null,
  responseError: null,
}

vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: {
        use: (handler) => {
          interceptors.request = handler
        }
      },
      response: {
        use: (_success, errorHandler) => {
          interceptors.responseError = errorHandler
        }
      }
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }

  return {
    default: {
      create: vi.fn(() => instance)
    }
  }
})

describe('api interceptors', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    await import('./index.js')
  })

  it('prefers admin token in request interceptor', () => {
    localStorage.setItem('token', 'user-token')
    localStorage.setItem('admin_auth_token', 'admin-token')

    const config = interceptors.request({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer admin-token')
  })

  it('clears tokens on 401 responses', async () => {
    localStorage.setItem('token', 'user-token')
    localStorage.setItem('admin_auth_token', 'admin-token')

    await expect(
      interceptors.responseError({ response: { status: 401, data: { detail: 'unauthorized' } } })
    ).rejects.toEqual({ detail: 'unauthorized' })

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
  })
})