import axios from 'axios'

const ADMIN_TOKEN_KEY = 'admin_auth_token'

const api = axios.create({
  baseURL: '/api',
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
  update: (id, data) => api.put(`/scores/${id}`, data),
  delete: (id) => api.delete(`/scores/${id}`),
  batchImport: (data) => api.post('/scores/batch/import', data),
  getAnnualRanking: (year, bowType) =>
    api.get(`/scores/annual-ranking/${year}/${bowType}`)
}

// ==================== 赛事 API ====================
export const eventAPI = {
  getList: (params = {}) => api.get('/events', { params }),
  getDetail: (id) => api.get(`/events/${id}`),
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
  getAll: () => api.get('/dictionaries')
}

