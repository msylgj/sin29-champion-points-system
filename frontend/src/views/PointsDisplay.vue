<template>
  <div class="points-display-page safe-area">
    <div class="page-header">
      <h1>积分排名</h1>
      <p class="subtitle">查看年度弓种积分排名</p>
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
            <option value="recurve">反曲弓</option>
            <option value="compound">复合弓</option>
            <option value="barebow">光弓</option>
            <option value="traditional">传统弓</option>
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

        <div v-else-if="ranking.length === 0" class="empty-state">
          <p>暂无该年度该弓种的成绩数据</p>
        </div>

        <div v-else class="ranking-content">
          <!-- 统计摘要 -->
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">参赛人数</span>
              <span class="stat-value">{{ ranking.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最高积分</span>
              <span class="stat-value">{{ ranking[0]?.total_points.toFixed(1) || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">冠军</span>
              <span class="stat-value">{{ ranking[0]?.name || '-' }}</span>
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
              <tr v-for="(athlete, index) in ranking" :key="`${athlete.name}-${athlete.club}`" :class="{ 'highlight': athlete.highlight }">
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
            <h3 class="section-title">前8名详细信息</h3>
            <div v-for="(athlete, index) in ranking.slice(0, 8)" :key="`${athlete.name}-${athlete.club}`" class="athlete-card">
              <div class="card-header">
                <div class="rank-info">
                  <span class="rank-number">{{ athlete.ranking }}</span>
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
      <div v-if="ranking.length > 0" class="action-bar">
        <button @click="exportToCSV" class="btn-export">
          📥 导出为CSV
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { scoreAPI } from '@/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const ranking = ref([])
const selectedYear = ref('')
const selectedBowType = ref('')
const availableYears = ref([])

// 获取赛制标签
const getFormatLabel = (format) => {
  const labels = {
    'ranking': '排名赛',
    'elimination': '淘汰赛',
    'mixed_doubles': '混双赛',
    'team': '团体赛'
  }
  return labels[format] || format
}

// 初始化可选的年度
const initYears = () => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = currentYear + 2; i >= currentYear - 5; i--) {
    years.push(i)
  }
  availableYears.value = years
  selectedYear.value = currentYear
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

// 导出CSV
const exportToCSV = () => {
  if (ranking.value.length === 0) return

  const headers = ['排名', '姓名', '俱乐部', '积分', '参赛次数']
  const rows = ranking.value.map(athlete => [
    athlete.ranking,
    athlete.name,
    athlete.club || '',
    athlete.total_points.toFixed(1),
    athlete.scores.length
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${selectedYear.value}年${selectedBowType.value}弓排名.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  initYears()
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

    thead {
      background: #f9f9f9;
      border-bottom: 2px solid #e0e0e0;

      th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        font-size: 13px;
        color: #666;
      }
    }

    tbody tr {
      border-bottom: 1px solid #f0f0f0;

      &.highlight {
        background: #fffef0;
        
        .col-rank {
          font-weight: 600;
          color: #ff6b6b;
        }

        .rank-badge {
          background: linear-gradient(135deg, #ffd89b 0%, #ff6b6b 100%);
          color: white;
          font-weight: 600;
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
            background: #f0f0f0;
            border-radius: 4px;
            text-align: center;
            font-weight: 500;
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
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
