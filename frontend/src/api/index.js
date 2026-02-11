import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
          window.location.href = '/login'
          break
        case 403:
          console.error('无权限访问')
          break
        case 500:
          console.error('服务器错误')
          break
      }
    }
    return Promise.reject(error)
  }
)

// ==================== 运动员 API ====================
export const athleteAPI = {
  getList: (params = {}) => api.get('/athletes', { params }),
  getDetail: (id) => api.get(`/athletes/${id}`),
  create: (data) => api.post('/athletes', data),
  update: (id, data) => api.put(`/athletes/${id}`, data),
  delete: (id) => api.delete(`/athletes/${id}`),
  batchImport: (data) => api.post('/athletes/batch/import', data)
}

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

// ==================== 统计排名 API ====================
export const statsAPI = {
  getRankings: (params = {}) => api.get('/stats/rankings', { params }),
  getAggregate: (athleteId, params = {}) => 
    api.get(`/stats/athlete/${athleteId}/aggregate`, { params }),
  getTopPerformers: (params = {}) => 
    api.get('/stats/top-performers', { params })
}

export default api
