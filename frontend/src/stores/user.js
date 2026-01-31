// Pinia 用户信息存储

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 状态
  const userInfo = ref({
    id: 1,
    name: '张三',
    phone: '13800138000',
    gender: 'male',
    createdAt: '2024-01-01'
  })
  
  const isLoggedIn = computed(() => !!userInfo.value.id)
  
  // 方法
  const setUserInfo = (info) => {
    userInfo.value = { ...userInfo.value, ...info }
  }
  
  const clearUserInfo = () => {
    userInfo.value = {}
  }
  
  const login = async (credentials) => {
    // 模拟登录逻辑
    setUserInfo({
      id: 1,
      ...credentials
    })
  }
  
  const logout = () => {
    clearUserInfo()
  }
  
  return {
    userInfo,
    isLoggedIn,
    setUserInfo,
    clearUserInfo,
    login,
    logout
  }
}, {
  persist: true  // 持久化存储
})
