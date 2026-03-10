import axios from 'axios'

const ADMIN_TOKEN_KEY = 'admin_auth_token'

// 确定API基础URL
// 在生产/容器中使用环境变量，本地开发中使用相对路径（通过Vite proxy）
const getBaseURL = () => {
  // 如果是生产构建或容器环境，使用VITE_API_BASE_URL
  if (import.meta.env.VITE_API_BASE_URL && import.meta.env.MODE === 'production') {
    return import.meta.env.VITE_API_BASE_URL
  }
  // 开发环境默认使用相对路径（通过Vite proxy: /api -> http://backend:8000/api）
  return '/api'
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY)
    const authToken = adminToken || token
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`
    }
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
          localStorage.removeItem('token')
          localStorage.removeItem(ADMIN_TOKEN_KEY)
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
    return Promise.reject(error.response?.data || error)
  }
)

// ==================== 成绩 API ====================
export const scoreAPI = {
  getList: (params = {}) => api.get('/scores', { params }),
  getDetail: (id) => api.get(`/scores/${id}`),
  create: (data) => api.post('/scores', data),
  update: (id, data) => api.put(`/scores/${id}`, data),
  delete: (id) => api.delete(`/scores/${id}`),
  batchImport: (data) => api.post('/scores/batch/import', data),
  recalculate: () => api.post('/scores/recalculate'),
  getAthleteScores: (athleteId, params = {}) => 
    api.get(`/scores/athlete/${athleteId}/scores`, { params }),
  getEventRanking: (eventId, params = {}) =>
    api.get(`/scores/event/${eventId}/ranking`, { params }),
  getAnnualRanking: (year, bowType) =>
    api.get(`/scores/annual-ranking/${year}/${bowType}`)
}

// ==================== 赛事 API ====================
export const eventAPI = {
  getList: (params = {}) => api.get('/events', { params }),
  getDetail: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  createWithConfigs: (data) => api.post('/events/with-configs', data)
}

export const eventConfigAPI = {
  create: (data) => api.post('/event-configurations', data),
  update: (id, data) => api.put(`/event-configurations/${id}`, data),
  delete: (id) => api.delete(`/event-configurations/${id}`)
}

export const authAPI = {
  login: (password) => api.post('/auth/login', { password })
}

// ==================== 字典 API ====================
export const dictionaryAPI = {
  getBowTypes: () => api.get('/dictionaries/bow-types'),
  getDistances: () => api.get('/dictionaries/distances'),
  getCompetitionFormats: () => api.get('/dictionaries/competition-formats'),
  getAll: () => api.get('/dictionaries')
}

export default api
