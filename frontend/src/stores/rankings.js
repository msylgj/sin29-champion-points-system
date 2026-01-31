// Pinia 排名数据存储

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { statsAPI } from '@/api'

export const useRankingsStore = defineStore('rankings', () => {
  // 状态
  const rankings = ref([])
  const topPerformers = ref([])
  const athleteAggregate = ref(null)
  const loading = ref(false)
  const filters = ref({
    page: 1,
    page_size: 20,
    year: new Date().getFullYear(),
    season: null,
    gender_group: null,
    bow_type: null
  })
  
  // 计算属性
  const myRank = computed(() => {
    // TODO: 根据当前用户查找排名
    return null
  })
  
  const topThree = computed(() => rankings.value.slice(0, 3))
  
  // 方法
  const fetchRankings = async (params = {}) => {
    loading.value = true
    try {
      const result = await statsAPI.getRankings({
        ...filters.value,
        ...params
      })
      rankings.value = result.items || []
      return result
    } catch (error) {
      console.error('获取排名失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }
  
  const fetchTopPerformers = async (params = {}) => {
    loading.value = true
    try {
      const result = await statsAPI.getTopPerformers(params)
      topPerformers.value = result
      return result
    } finally {
      loading.value = false
    }
  }
  
  const fetchAthleteAggregate = async (athleteId, params = {}) => {
    loading.value = true
    try {
      const result = await statsAPI.getAggregate(athleteId, params)
      athleteAggregate.value = result
      return result
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
      gender_group: null,
      bow_type: null
    }
  }
  
  return {
    rankings,
    topPerformers,
    athleteAggregate,
    loading,
    filters,
    myRank,
    topThree,
    fetchRankings,
    fetchTopPerformers,
    fetchAthleteAggregate,
    setFilters,
    resetFilters
  }
}, {
  persist: true
})
