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
            <option v-for="bow in bowTypes" :key="bow.code" :value="bow.code">
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
            <option v-for="club in availableClubs" :key="club" :value="club">
              {{ club || '（无俱乐部）' }}
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
              <tr v-for="(athlete, index) in filteredRanking" :key="`${athlete.name}-${athlete.club}`" :class="{ 'highlight': athlete.highlight }">
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
            <div v-for="(athlete, index) in hasActiveFilter ? filteredRanking : filteredRanking.slice(0, 8)" :key="`${athlete.name}-${athlete.club}`" class="athlete-card">
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { scoreAPI, dictionaryAPI, eventAPI, authAPI } from '@/api'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const ranking = ref([])
const selectedYear = ref('')
const selectedBowType = ref('')
const availableYears = ref([])
const bowTypes = ref([])
const showAuthDialog = ref(false)
const adminPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const pendingManageRoute = ref('/score-import')
const nameKeyword = ref('')
const selectedClub = ref('')

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
  })
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
    if (club !== '' && (athlete.club || '') !== club) return false
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
  try {
    const response = await eventAPI.getList({ page_size: 100 })
    const years = new Set()
    
    if (response.items && Array.isArray(response.items)) {
      response.items.forEach(event => {
        if (event.year) {
          years.add(event.year)
        }
      })
    }
    
    availableYears.value = Array.from(years).sort((a, b) => b - a)
    
    // 选择第一个可用的年份
    if (availableYears.value.length > 0) {
      selectedYear.value = availableYears.value[0]
    }
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
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    const response = await dictionaryAPI.getAll()
    if (response.success && response.data) {
      bowTypes.value = response.data.bowTypes || []
    }
  } catch (error) {
    console.error('加载字典数据失败:', error)
  }
}

// 加载排名数据
const loadRanking = async () => {
  if (!selectedYear.value || !selectedBowType.value) {
    ranking.value = []
    return
  }

  loading.value = true
  try {
    const response = await scoreAPI.getAnnualRanking(selectedYear.value, selectedBowType.value)
    ranking.value = response.athletes || []
  } catch (error) {
    console.error('Error loading ranking:', error)
    ranking.value = []
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
  const clubSuffix = selectedClub.value ? `_${selectedClub.value}` : ''
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
  if (bowTypes.value.length > 0) {
    const bowTypeParam = route.query.bowType
    
    if (typeof bowTypeParam === 'string' && bowTypeParam && bowTypes.value.some(b => b.code === bowTypeParam)) {
      selectedBowType.value = bowTypeParam
    } else {
      selectedBowType.value = bowTypes.value[0].code
    }
  }
  
  // 年份和弓种都有时加载排名
  if (selectedYear.value && selectedBowType.value) {
    await loadRanking()
  }
})
</script>

<style scoped lang="scss">
.points-display-page {
  padding-bottom: 100px;
  background-color: #f5f5f5;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px 20px 20px;
  margin-bottom: 20px;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
  }

  .header-title-wrap {
    flex: 1;
    text-align: center;
  }

  h1 {
    margin: 0 0 5px;
    font-size: 28px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0;
    opacity: 0.9;
    font-size: 14px;
  }

  .btn-manage {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .header-spacer {
    width: 88px;
    height: 1px;
    flex-shrink: 0;
  }
}

.display-container {
  padding: 0 15px;
}

.filters-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;

  .filter-group {
    background: white;
    padding: 12px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      margin-bottom: 6px;
    }

    .filter-input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;

      &:focus {
        outline: none;
        border-color: #667eea;
      }
    }
  }
}

.ranking-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f0f0f0;
    border-top-color: #667eea;
    border-radius: 50%;
    margin: 0 auto 10px;
    animation: spin 1s linear infinite;
  }

  p {
    color: #999;
    font-size: 14px;
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.ranking-content {
  .stats-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;

    .stat-item {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 6px;
      text-align: center;

      .stat-label {
        display: block;
        font-size: 12px;
        opacity: 0.9;
        margin-bottom: 5px;
      }

      .stat-value {
        display: block;
        font-size: 18px;
        font-weight: 600;
      }
    }
  }

  .ranking-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    table-layout: fixed;

    thead {
      background: #f9f9f9;
      border-bottom: 2px solid #e0e0e0;

      th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        font-size: 13px;
        color: #666;

        &.col-rank {
          width: 60px;
          text-align: center;
        }

        &.col-name {
          width: 20%;
        }

        &.col-club {
          width: 30%;
        }

        &.col-points {
          width: 90px;
          text-align: right;
        }

        &.col-count {
          width: 90px;
          text-align: center;
        }
      }
    }

    tbody tr {
      border-bottom: 1px solid #f0f0f0;

      &.highlight {
        background: #f4f8ff;
        
        .col-rank {
          font-weight: 600;
          color: #1f4ea3;
        }

        .rank-badge {
          background: linear-gradient(135deg, #edf4ff 0%, #cfe1ff 100%);
          color: #1a3d80;
          border: 1px solid #9dbaf0;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(39, 94, 187, 0.2);
        }
      }

      &:hover {
        background: #fafafa;
      }

      td {
        padding: 12px;
        font-size: 13px;
        color: #333;

        &.col-rank {
          text-align: center;
          width: 60px;

          .rank-badge {
            display: inline-block;
            min-width: 30px;
            padding: 4px 8px;
            background: linear-gradient(135deg, #f4f8ff 0%, #dbe8ff 100%);
            color: #275ebb;
            border: 1px solid #b8cff5;
            border-radius: 4px;
            text-align: center;
            font-weight: 600;
          }
        }

        &.col-name {
          font-weight: 500;
          color: #333;
        }

        &.col-club {
          color: #999;
          font-size: 12px;
        }

        &.col-points {
          font-weight: 600;
          color: #667eea;
          text-align: right;
        }

        &.col-count {
          text-align: center;
          color: #999;
        }
      }
    }
  }
}

.detailed-rankings {
  margin-top: 30px;
  border-top: 2px solid #e0e0e0;
  padding-top: 20px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 15px;
    color: #333;
  }

  .athlete-card {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 12px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;

      .rank-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .rank-number {
          background: #f5f6f8;
          color: #6f7785;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d8dde6;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;

          &.rank-first {
            background: linear-gradient(135deg, #fff9e5 0%, #ffe4a3 100%);
            color: #7a4a00;
            border-color: #efc469;
            box-shadow: 0 3px 10px rgba(173, 119, 22, 0.24);
          }

          &.rank-second {
            background: linear-gradient(135deg, #f8fbff 0%, #dfe9f5 100%);
            color: #41566f;
            border-color: #b7c6d8;
            box-shadow: 0 3px 10px rgba(102, 120, 143, 0.22);
          }

          &.rank-third {
            background: linear-gradient(135deg, #fff3eb 0%, #f2c8ac 100%);
            color: #6d3b25;
            border-color: #d99d7a;
            box-shadow: 0 3px 10px rgba(152, 90, 58, 0.22);
          }
        }

        .name-info {
          .name {
            font-weight: 600;
            color: #333;
            font-size: 14px;
          }

          .club {
            font-size: 12px;
            color: #999;
            margin-top: 2px;
          }
        }
      }

      .points-badge {
        background: linear-gradient(135deg, #ffd89b 0%, #ffa502 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 13px;
      }
    }

    .card-body {
      .scores-list {
        .score-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 12px;
          color: #666;
          border-bottom: 1px dashed #f0f0f0;

          &:last-child {
            border-bottom: none;
          }

          .event-season {
            flex: 1;
            font-weight: 500;
            color: #333;
          }

          .score-detail {
            flex: 1;
            text-align: center;
          }

          .rank {
            width: 60px;
            text-align: right;
          }

          .points {
            width: 50px;
            text-align: right;
            font-weight: 600;
            color: #667eea;
          }
        }
      }
    }
  }
}

.action-bar {
  display: flex;
  gap: 10px;
  padding: 20px 0;
  justify-content: center;

  .btn-export {
    padding: 10px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      background: #764ba2;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  }
}

.auth-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 999;
}

.auth-dialog {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);

  h3 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #333;
  }

  .auth-tip {
    margin: 0 0 12px;
    font-size: 13px;
    color: #666;
  }

  .auth-input {
    width: 100%;
    border: 1px solid #d7deef;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .auth-error {
    margin-top: 8px;
    color: #d14343;
    font-size: 12px;
  }

  .auth-actions {
    margin-top: 14px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-auth-cancel,
  .btn-auth-submit {
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-auth-cancel {
    background: #eff1f7;
    color: #444;
  }

  .btn-auth-submit {
    background: #4d79ff;
    color: #fff;
  }

  .btn-auth-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .filters-section {
    grid-template-columns: 1fr;
  }

  .ranking-content .ranking-table {
    font-size: 12px;

    th, td {
      padding: 8px;
    }
  }

  .detailed-rankings .athlete-card {
    padding: 10px;

    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
  }
}
</style>
