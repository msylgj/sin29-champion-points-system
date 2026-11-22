import axios from 'axios'

import { getAdminAuthRedirect, getAdminSessionSnapshot, recoverAdminUnauthorized } from '@/utils/adminAuth'

function isProtectedAdminRequest(config) {
  if (config.skipAdminAuthRecovery) return false
  try {
    const url = new URL(config.url || '', window.location.origin)
    if (url.origin !== window.location.origin) return false
    const path = url.pathname.replace(/^\/api(?=\/)/, '')
    if (path === '/auth/login' || path === '/events/years' || path.startsWith('/scores/annual-ranking/')) return false
    return /^\/(scores|events|event-configurations|event-registrations|scoring-rules)(\/|$)/.test(path)
  } catch {
    return false
  }
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const snapshot = getAdminSessionSnapshot()
    config.headers ||= {}
    // Reused configs/default headers must not keep an expired Authorization value.
    for (const key of Object.keys(config.headers)) {
      if (key.toLowerCase() === 'authorization') delete config.headers[key]
    }
    if (snapshot.token) config.headers.Authorization = `Bearer ${snapshot.token}`
    config.adminSessionSnapshot = snapshot
    config.adminAuthProtected = isProtectedAdminRequest(config)
    config.adminAuthRedirect = getAdminAuthRedirect()
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (error.config?.adminAuthProtected && isProtectedAdminRequest(error.config)) {
            recoverAdminUnauthorized(error.config.adminSessionSnapshot, error.config.adminAuthRedirect)
          }
          break
        case 403:
          console.error('无权限访问')
          break
        case 422:
          // 处理验证错误
          console.error('验证失败:', error.response.data)
          break
        case 500:
          console.error('服务器错误')
          break
      }
    }
    if (error.config?.preserveStatus && error.response) {
      return Promise.reject({ ...error.response.data, status: error.response.status })
    }
    return Promise.reject(error.response?.data || error)
  }
)

// ==================== 成绩 API ====================
export const scoreAPI = {
  getList: (params = {}) => api.get('/scores', { params }),
  update: (id, data) => api.put(`/scores/${id}`, data),
  delete: (id) => api.delete(`/scores/${id}`),
  batchImport: (data) => api.post('/scores/batch/import', data),
  getAnnualRanking: (year, bowType) =>
    api.get(`/scores/annual-ranking/${year}/${bowType}`)
}

// ==================== 赛事 API ====================
export const eventAPI = {
  getYears: () => api.get('/events/years'),
  getList: (params = {}) => api.get('/events', { params }),
  getDetail: (id) => api.get(`/events/${id}`),
  delete: (id, confirmationName) => api.delete(`/events/${id}`, { data: { confirmation_name: confirmationName } }),
  rankingScorecards: (id, data, signal) => api.post(`/events/${id}/ranking-scorecards`, data, { responseType: 'blob', timeout: 60000, signal }),
  eliminationRounds: (id, participantCount, signal) => api.get(`/events/${id}/elimination-rounds`, { params: { participant_count: participantCount }, signal }),
  eliminationScorecards: (id, data, signal) => api.post(`/events/${id}/elimination-scorecards`, data, { responseType: 'blob', timeout: 60000, signal }),
  createWithConfigs: (data) => api.post('/events/with-configs', data)
}

export const eventConfigAPI = {
  create: (data) => api.post('/event-configurations', data),
  update: (id, data) => api.put(`/event-configurations/${id}`, data),
  delete: (id) => api.delete(`/event-configurations/${id}`)
}

export const eventRegistrationAPI = {
  getList: (params = {}) => api.get('/event-registrations', { params }),
  batchImport: (data) => api.post('/event-registrations/batch/import', data),
  update: (id, data) => api.put(`/event-registrations/${id}`, data),
  delete: (id) => api.delete(`/event-registrations/${id}`),
}

// Preserve status only for version publishing, so stale drafts can handle 409.
export const scoringRuleAPI = {
  getList: () => api.get('/scoring-rules', { preserveStatus: true }),
  create: data => api.post('/scoring-rules', data, { preserveStatus: true }),
  delete: id => api.delete(`/scoring-rules/${id}`, { preserveStatus: true }),
}

export const authAPI = {
  login: (password) => api.post('/auth/login', { password }, { skipAdminAuthRecovery: true })
}

// ==================== 字典 API ====================
export const dictionaryAPI = {
  getAll: () => api.get('/dictionaries')
}
