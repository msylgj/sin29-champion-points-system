<template>
  <div class="points-display-page safe-area">
    <div class="page-header">
      <div class="header-top">
        <span class="header-spacer" aria-hidden="true"></span>
        <div class="header-title-wrap">
          <h1>积分排名</h1>
          <p class="subtitle">查看年度弓种积分排名</p>
        </div>
        <button class="btn-manage" @click="navigateToManage" title="管理赛事和成绩">
          ⚙️ 管理
        </button>
      </div>
    </div>

    <div class="display-container">
      <div v-if="yearLoadFailed || dictionaryLoadFailed" class="page-feedback-list">
        <div v-if="yearLoadFailed" class="failure-notice">
          <div>
            <strong>年度列表加载失败</strong>
            <p>当前已回退到最近 5 年的兜底选项，你也可以重新拉取赛事年度。</p>
          </div>
          <button type="button" class="btn-retry-inline" @click="initYears">重试加载年度</button>
        </div>
        <div v-if="dictionaryLoadFailed" class="failure-notice">
          <div>
            <strong>弓种字典加载失败</strong>
            <p>当前无法正确展示弓种选项，请检查网络后重试。</p>
          </div>
          <button type="button" class="btn-retry-inline" @click="loadDictionaries">重试加载弓种</button>
        </div>
      </div>

      <!-- 过滤器 -->
      <div class="filters-section">
        <div class="filter-group">
          <label for="year-select">年度</label>
          <select v-model.number="selectedYear" id="year-select" class="filter-input" @change="loadRanking">
            <option value="">请选择年度</option>
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label for="bow-type-select">弓种</label>
          <select v-model="selectedBowType" id="bow-type-select" class="filter-input" @change="loadRanking">
            <option value="">请选择弓种</option>
            <option v-for="bow in rankingBowTypes" :key="bow.code" :value="bow.code">
              {{ bow.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label for="name-search">姓名</label>
          <input v-model="nameKeyword" id="name-search" class="filter-input" type="text" placeholder="输入姓名搜索" />
        </div>

        <div class="filter-group">
          <label for="club-filter">俱乐部</label>
          <select v-model="selectedClub" id="club-filter" class="filter-input">
            <option value="">全部俱乐部</option>
            <option v-for="club in availableClubs" :key="club.value" :value="club.value">
              {{ club.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- 排名表格 -->
      <div class="ranking-section">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>加载排名中...</p>
        </div>

        <div v-else-if="!selectedYear || !selectedBowType" class="empty-state">
          <p>请选择年度和弓种查看排名</p>
        </div>

        <div v-else-if="rankingLoadFailed" class="empty-state failure-state">
          <p>排名加载失败，请稍后重试</p>
          <button type="button" class="btn-retry-panel" @click="loadRanking">重试加载排名</button>
        </div>

        <div v-else-if="filteredRanking.length === 0" class="empty-state">
          <p>暂无该年度该弓种的成绩数据</p>
        </div>

        <div v-else class="ranking-content">
          <!-- 统计摘要 -->
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">参赛人数</span>
              <span class="stat-value">{{ filteredRanking.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最高积分</span>
              <span class="stat-value">{{ filteredRanking[0]?.total_points.toFixed(1) || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">冠军</span>
              <span class="stat-value">{{ filteredRanking[0]?.name || '-' }}</span>
            </div>
          </div>

          <!-- 排名表格 -->
          <table class="ranking-table">
            <thead>
              <tr>
                <th class="col-rank">排名</th>
                <th class="col-name">姓名</th>
                <th class="col-club">俱乐部</th>
                <th class="col-points">积分</th>
                <th class="col-count">参赛次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="athlete in filteredRanking" :key="`${athlete.name}-${athlete.club}`" :class="{ 'highlight': athlete.highlight }">
                <td class="col-rank">
                  <span class="rank-badge" :class="{ 'top-badge': athlete.highlight }">
                    {{ athlete.ranking }}
                  </span>
                </td>
                <td class="col-name">{{ athlete.name }}</td>
                <td class="col-club">{{ athlete.club || '-' }}</td>
                <td class="col-points">{{ athlete.total_points.toFixed(1) }}</td>
                <td class="col-count">{{ athlete.scores.length }}次</td>
              </tr>
            </tbody>
          </table>

          <!-- 详细信息 -->
          <div class="detailed-rankings">
            <h3 class="section-title">{{ hasActiveFilter ? '详细信息' : '前8名详细信息' }}</h3>
            <div v-for="athlete in hasActiveFilter ? filteredRanking : filteredRanking.slice(0, 8)" :key="`${athlete.name}-${athlete.club}`" class="athlete-card">
              <div class="card-header">
                <div class="rank-info">
                  <span class="rank-number" :class="getTopRankClass(athlete.ranking)">{{ athlete.ranking }}</span>
                  <div class="name-info">
                    <div class="name">{{ athlete.name }}</div>
                    <div class="club">{{ athlete.club || '个人' }}</div>
                  </div>
                </div>
                <div class="points-badge">{{ athlete.total_points.toFixed(1) }}</div>
              </div>

              <div class="card-body">
                <div class="scores-list">
                  <div v-for="score in athlete.scores" :key="`${score.event_id}-${score.distance}-${score.format}`" class="score-item">
                    <span class="event-season">{{ score.event_season }}</span>
                    <span class="score-detail">{{ score.distance }} · {{ getFormatLabel(score.format) }}</span>
                    <span class="rank">第{{ score.rank }}名</span>
                    <span class="points">{{ score.points.toFixed(1) }}分</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 导出按钮 -->
      <div v-if="filteredRanking.length > 0" class="action-bar">
        <button @click="exportToExcel" class="btn-export">
          📥 导出为 Excel
        </button>
      </div>

      <div v-if="showAuthDialog" class="auth-dialog-mask" @click.self="closeAuthDialog">
        <div class="auth-dialog">
          <h3>管理认证</h3>
          <p class="auth-tip">请输入管理密码以继续访问管理页面</p>
          <input
            v-model="adminPassword"
            type="password"
            class="auth-input"
            placeholder="请输入管理密码"
            @keyup.enter="submitAdminAuth"
          />
          <div v-if="authError" class="auth-error">{{ authError }}</div>
          <div class="auth-actions">
            <button type="button" class="btn-auth-cancel" @click="closeAuthDialog">取消</button>
            <button type="button" class="btn-auth-submit" :disabled="authLoading" @click="submitAdminAuth">
              {{ authLoading ? '验证中...' : '确认' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="pageMsg.successMsg.value" class="success-message">
        {{ pageMsg.successMsg.value }}
      </div>
      <div v-if="pageMsg.errorMsg.value" class="error-message">
        {{ pageMsg.errorMsg.value }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { scoreAPI, eventAPI, authAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useMessage } from '@/composables/useMessage'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const ranking = ref([])
const selectedYear = ref('')
const selectedBowType = ref('')
const availableYears = ref([])
const { bowTypes, loadDictionaries: fetchDictionaries } = useDictionaries()
const showAuthDialog = ref(false)
const adminPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const pendingManageRoute = ref('/score-import')
const nameKeyword = ref('')
const selectedClub = ref('')
const pageMsg = useMessage(5000)
const yearLoadFailed = ref(false)
const dictionaryLoadFailed = ref(false)
const rankingLoadFailed = ref(false)
const NO_CLUB_FILTER = '__NO_CLUB__'
const rankingBowTypes = computed(() => bowTypes.value.filter(item => item.code !== 'sightless'))

// 从排名数据中提取可用的俱乐部列表
const availableClubs = computed(() => {
  const clubs = new Set()
  ranking.value.forEach(athlete => {
    clubs.add(athlete.club || '')
  })
  return Array.from(clubs).sort((a, b) => {
    if (!a) return 1
    if (!b) return -1
    return a.localeCompare(b, 'zh-CN')
  }).map(club => ({
    value: club === '' ? NO_CLUB_FILTER : club,
    label: club || '（无俱乐部）'
  }))
})

// 根据姓名搜索和俱乐部筛选过滤排名
const hasActiveFilter = computed(() => {
  return (nameKeyword.value || '').trim() !== '' || selectedClub.value !== ''
})

const filteredRanking = computed(() => {
  const keyword = (nameKeyword.value || '').trim().toLowerCase()
  const club = selectedClub.value
  return ranking.value.filter(athlete => {
    if (keyword && !(athlete.name || '').toLowerCase().includes(keyword)) return false
    if (club === NO_CLUB_FILTER && (athlete.club || '') !== '') return false
    if (club !== '' && club !== NO_CLUB_FILTER && (athlete.club || '') !== club) return false
    return true
  })
})

const getTopRankClass = (rank) => {
  if (rank === 1) return 'rank-first'
  if (rank === 2) return 'rank-second'
  if (rank === 3) return 'rank-third'
  return ''
}

// 获取赛制标签
const getFormatLabel = (format) => {
  const labels = {
    'ranking': '排位赛',
    'elimination': '淘汰赛',
    'mixed_doubles': '混双赛',
    'team': '团体赛'
  }
  return labels[format] || format
}

// 初始化可选的年度 - 从数据库获取实际的事件年份
const initYears = async () => {
  pageMsg.clear()
  try {
    const response = await eventAPI.getYears()
    availableYears.value = Array.isArray(response.items) ? response.items : []
    
    // 选择第一个可用的年份
    if (availableYears.value.length > 0) {
      selectedYear.value = availableYears.value[0]
    }
    yearLoadFailed.value = false
  } catch (error) {
    console.error('加载年度数据失败:', error)
    // 降级方案：使用静态年份
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i)
    }
    availableYears.value = years
    selectedYear.value = currentYear
    yearLoadFailed.value = true
    pageMsg.show('error', '年度列表加载失败，已切换为最近 5 年兜底选项')
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    await fetchDictionaries()
    dictionaryLoadFailed.value = false
  } catch (error) {
    console.error('加载字典数据失败:', error)
    dictionaryLoadFailed.value = true
    pageMsg.show('error', '弓种字典加载失败，请重试')
  }
}

// 加载排名数据
const loadRanking = async () => {
  if (!selectedYear.value || !selectedBowType.value) {
    ranking.value = []
    return
  }

  loading.value = true
  rankingLoadFailed.value = false
  try {
    const response = await scoreAPI.getAnnualRanking(selectedYear.value, selectedBowType.value)
    ranking.value = response.athletes || []
  } catch (error) {
    console.error('Error loading ranking:', error)
    ranking.value = []
    rankingLoadFailed.value = true
    pageMsg.show('error', '排名加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 导出 Excel
const exportToExcel = async () => {
  if (filteredRanking.value.length === 0) return

  const XLSX = await import('xlsx')

  const headers = ['排名', '姓名', '俱乐部', '积分', '参赛次数']
  const rows = filteredRanking.value.map(athlete => [
    athlete.ranking,
    athlete.name,
    athlete.club || '',
    athlete.total_points.toFixed(1),
    athlete.scores.length
  ])

  // 创建工作表
  const worksheetData = [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 8 },  // 排名
    { wch: 15 }, // 姓名
    { wch: 20 }, // 俱乐部
    { wch: 12 }, // 积分
    { wch: 12 }  // 参赛次数
  ]

  // 创建工作簿
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '排名列表')

  // 生成文件名
  const bowTypeLabel = bowTypes.value.find(b => b.code === selectedBowType.value)?.name || selectedBowType.value
  const clubSuffix = selectedClub.value === NO_CLUB_FILTER
    ? '_无俱乐部'
    : (selectedClub.value ? `_${selectedClub.value}` : '')
  const filename = `${selectedYear.value}年${bowTypeLabel}积分排名${clubSuffix}.xlsx`

  // 导出文件
  XLSX.writeFile(workbook, filename)
}

// 导航到管理页面（成绩导入）
const navigateToManage = () => {
  const token = localStorage.getItem('admin_auth_token')
  if (token) {
    router.push('/score-import')
    return
  }
  pendingManageRoute.value = '/score-import'
  showAuthDialog.value = true
  adminPassword.value = ''
  authError.value = ''
}

const closeAuthDialog = () => {
  showAuthDialog.value = false
  adminPassword.value = ''
  authError.value = ''
}

const submitAdminAuth = async () => {
  if (!adminPassword.value) {
    authError.value = '请输入管理密码'
    return
  }

  authLoading.value = true
  authError.value = ''
  try {
    const response = await authAPI.login(adminPassword.value)
    localStorage.setItem('admin_auth_token', response.access_token)
    const targetPath = pendingManageRoute.value || '/score-import'
    closeAuthDialog()
    router.push(targetPath)
  } catch (error) {
    authError.value = error.detail || '密码验证失败'
  } finally {
    authLoading.value = false
  }
}

onMounted(async () => {
  const adminToken = localStorage.getItem('admin_auth_token')

  const storageAuthRequired = sessionStorage.getItem('admin_auth_required')
  const storageRedirect = sessionStorage.getItem('admin_auth_redirect')

  if (storageAuthRequired === '1') {
    pendingManageRoute.value = storageRedirect || '/score-import'
    if (!adminToken) {
      showAuthDialog.value = true
    }
    sessionStorage.removeItem('admin_auth_required')
    sessionStorage.removeItem('admin_auth_redirect')
  }

  // 首先加载年份和字典
  await initYears()
  await loadDictionaries()
  
  // 总是设置弓种（从内部路由状态或默认值）
  if (rankingBowTypes.value.length > 0) {
    const bowTypeParam = route.query.bowType
    
    if (typeof bowTypeParam === 'string' && bowTypeParam && rankingBowTypes.value.some(b => b.code === bowTypeParam)) {
      selectedBowType.value = bowTypeParam
    } else {
      selectedBowType.value = rankingBowTypes.value[0].code
    }
  }
  
  // 年份和弓种都有时加载排名
  if (selectedYear.value && selectedBowType.value) {
    await loadRanking()
  }
})
</script>

<style scoped lang="scss" src="@/styles/PointsDisplay.scss" />
