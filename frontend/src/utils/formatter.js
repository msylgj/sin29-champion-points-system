// 数据格式化工具

import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// 格式化日期
export const formatDate = (date, pattern = 'yyyy-MM-dd') => {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    return format(d, pattern, { locale: zhCN })
  } catch (e) {
    return '-'
  }
}

// 格式化时间
export const formatTime = (date) => {
  return formatDate(date, 'HH:mm:ss')
}

// 格式化日期和时间
export const formatDateTime = (date) => {
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss')
}

// 格式化相对时间
export const formatRelativeTime = (date) => {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    const now = new Date()
    const diff = now - d
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 60) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 30) return `${days} 天前`
    
    return formatDate(d)
  } catch (e) {
    return '-'
  }
}

// 格式化数字
export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '-'
  return Number(num).toFixed(decimals)
}

// 格式化积分
export const formatPoints = (points) => {
  return formatNumber(points, 1)
}

// 格式化排名
export const formatRank = (rank) => {
  if (!rank) return '-'
  const rankMap = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return rankMap[rank] ? `${rankMap[rank]} ${rank}` : `${rank}`
}

// 性别标签
export const getGenderLabel = (gender) => {
  const map = { male: '男', female: '女', mixed: '混合' }
  return map[gender] || gender
}

// 赛制标签
export const getFormatLabel = (format) => {
  const map = {
    ranking: '排名赛',
    elimination: '淘汰赛',
    team: '团体赛'
  }
  return map[format] || format
}

// 距离标签
export const getDistanceLabel = (distance) => {
  return distance || '-'
}

// 弓种标签
export const getBowTypeLabel = (bowType) => {
  const map = {
    recurve: '反曲弓',
    compound: '复合弓',
    longbow: '长弓'
  }
  return map[bowType] || bowType || '-'
}

// 积分等级
export const getPointsLevel = (points) => {
  if (points >= 100) return '优秀'
  if (points >= 80) return '良好'
  if (points >= 60) return '及格'
  return '待加强'
}

// 排名颜色
export const getRankColor = (rank) => {
  if (rank <= 3) return '#FFB800'  // 金牌色
  if (rank <= 10) return '#FF6B6B' // 红色
  if (rank <= 50) return '#4ECDC4' // 青色
  return '#95937A'                 // 灰色
}
