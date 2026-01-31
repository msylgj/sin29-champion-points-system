// Pinia 成绩数据存储

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scoreAPI } from '@/api'

export const useScoresStore = defineStore('scores', () => {
  // 状态
  const scores = ref([])
  const loading = ref(false)
  const currentScore = ref(null)
  const filters = ref({
    page: 1,
    page_size: 20,
    year: new Date().getFullYear(),
    season: null,
    distance: null,
    competition_format: null
  })
  
  // 计算属性
  const totalScores = computed(() => scores.value.length)
  const totalPoints = computed(() => {
    return scores.value.reduce((sum, score) => sum + (score.points || 0), 0)
  })
  
  // 方法
  const fetchScores = async (params = {}) => {
    loading.value = true
    try {
      const result = await scoreAPI.getList({
        ...filters.value,
        ...params
      })
      scores.value = result.items || []
      return result
    } catch (error) {
      console.error('获取成绩失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const fetchScoreDetail = async (id) => {
    loading.value = true
    try {
      const result = await scoreAPI.getDetail(id)
      currentScore.value = result
      return result
    } finally {
      loading.value = false
    }
  }
  
  const createScore = async (data) => {
    loading.value = true
    try {
      const result = await scoreAPI.create(data)
      scores.value.unshift(result)
      return result
    } finally {
      loading.value = false
    }
  }
  
  const updateScore = async (id, data) => {
    loading.value = true
    try {
      const result = await scoreAPI.update(id, data)
      const index = scores.value.findIndex(s => s.id === id)
      if (index >= 0) {
        scores.value[index] = result
      }
      currentScore.value = result
      return result
    } finally {
      loading.value = false
    }
  }
  
  const deleteScore = async (id) => {
    loading.value = true
    try {
      await scoreAPI.delete(id)
      scores.value = scores.value.filter(s => s.id !== id)
    } finally {
      loading.value = false
    }
  }
  
  const setFilters = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }
  
  const resetFilters = () => {
    filters.value = {
      page: 1,
      page_size: 20,
      year: new Date().getFullYear(),
      season: null,
      distance: null,
      competition_format: null
    }
  }
  
  return {
    scores,
    loading,
    currentScore,
    filters,
    totalScores,
    totalPoints,
    fetchScores,
    fetchScoreDetail,
    createScore,
    updateScore,
    deleteScore,
    setFilters,
    resetFilters
  }
}, {
  persist: true
})
