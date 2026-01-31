<template>
  <div class="rankings-page safe-area">
    <!-- 筛选器 -->
    <div class="filter-section">
      <div class="filter-controls">
        <select v-model.number="filters.year" class="filter-select" @change="onFilterChange">
          <option value="">{{ filters.year || '选择年度' }}</option>
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
        <select v-model="filters.season" class="filter-select" @change="onFilterChange">
          <option value="">{{ filters.season || '选择季度' }}</option>
          <option value="Q1">Q1</option>
          <option value="Q2">Q2</option>
          <option value="Q3">Q3</option>
          <option value="Q4">Q4</option>
        </select>
      </div>
    </div>

    <!-- 排名列表 -->
    <div class="rankings-content">
      <div v-if="rankingsStore.loading" class="loading">加载排名中...</div>
      <div v-else-if="rankingsStore.rankings.length === 0" class="empty">
        <p>暂无排名数据</p>
      </div>
      <div v-else>
        <!-- 前三名 -->
        <div v-if="rankingsStore.topThree.length > 0" class="top-three">
          <div
            v-for="(ranking, index) in rankingsStore.topThree"
            :key="ranking.athlete_id"
            class="medal-item"
            :class="medalClass(index)"
          >
            <div class="medal-icon">
              {{ medalIcon(index) }}
            </div>
            <div class="medal-info">
              <div class="athlete-name">{{ ranking.athlete_name }}</div>
              <div class="medal-stats">
                <span class="stat">{{ formatPoints(ranking.total_points) }} 分</span>
                <span class="stat">{{ ranking.competition_count }} 场</span>
              </div>
            </div>
            <div class="medal-rank">#{{ index + 1 }}</div>
          </div>
        </div>

        <!-- 完整排名列表 -->
        <div class="rankings-list">
          <div class="list-title">完整排名</div>
          <div
            v-for="(ranking, index) in rankingsStore.rankings"
            :key="ranking.athlete_id"
            class="ranking-item"
          >
            <div class="rank-number">
              <span class="rank-badge">{{ index + 1 }}</span>
            </div>
            <div class="rank-info">
              <div class="athlete-name">{{ ranking.athlete_name }}</div>
              <div class="rank-stats">
                <span class="stat">
                  <span class="label">积分:</span>
                  <span class="value">{{ formatPoints(ranking.total_points) }}</span>
                </span>
                <span class="stat">
                  <span class="label">参赛:</span>
                  <span class="value">{{ ranking.competition_count }}场</span>
                </span>
                <span class="stat">
                  <span class="label">平均:</span>
                  <span class="value">#{{ formatNumber(ranking.average_rank, 1) }}</span>
                </span>
              </div>
            </div>
            <div class="rank-points">
              {{ formatPoints(ranking.total_points) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRankingsStore } from '@/stores/rankings'
import { formatPoints, formatNumber } from '@/utils/formatter'

const rankingsStore = useRankingsStore()

const years = computed(() => {
  const year = new Date().getFullYear()
  return [year - 1, year, year + 1]
})

const filters = ref({
  page: 1,
  page_size: 100,
  year: new Date().getFullYear(),
  season: null,
  gender_group: null,
  bow_type: null
})

const medalClass = (index) => {
  return ['gold', 'silver', 'bronze'][index]
}

const medalIcon = (index) => {
  return ['🥇', '🥈', '🥉'][index]
}

const onFilterChange = async () => {
  filters.value.page = 1
  await rankingsStore.setFilters(filters.value)
  await rankingsStore.fetchRankings(filters.value)
}

onMounted(async () => {
  await rankingsStore.fetchRankings(filters.value)
})
</script>

<style scoped lang="scss">
.rankings-page {
  display: flex;
  flex-direction: column;
  padding-bottom: var(--spacing-2xl);
}

.filter-section {
  background: var(--white);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--gray-light);

  .filter-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .filter-select {
    padding: var(--spacing-md);
    border: 1px solid var(--gray-light);
    border-radius: var(--radius-md);
    font-size: var(--font-small);
    background: var(--light);
    cursor: pointer;
  }
}

.rankings-content {
  padding: 0 var(--spacing-lg);

  .loading,
  .empty {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--gray);
    font-size: var(--font-body);
  }

  .top-three {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-2xl);

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }

    .medal-item {
      background: var(--white);
      border-radius: var(--radius-lg);
      padding: var(--spacing-lg);
      text-align: center;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);

      .medal-icon {
        font-size: 48px;
      }

      .medal-info {
        flex: 1;

        .athlete-name {
          font-size: var(--font-body);
          font-weight: 600;
          color: var(--dark);
          margin-bottom: var(--spacing-sm);
        }

        .medal-stats {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          font-size: var(--font-small);

          .stat {
            color: var(--dark-gray);
          }
        }
      }

      .medal-rank {
        font-size: var(--font-h4);
        font-weight: 600;
        color: var(--primary);
      }

      &.gold {
        background: linear-gradient(135deg, #FFB800 0%, #FFC940 100%);
        color: var(--dark);

        .athlete-name {
          color: var(--dark);
        }

        .medal-rank {
          color: var(--dark);
        }
      }

      &.silver {
        background: linear-gradient(135deg, #C0C0C0 0%, #E0E0E0 100%);

        .athlete-name {
          color: var(--dark);
        }

        .medal-rank {
          color: var(--dark);
        }
      }

      &.bronze {
        background: linear-gradient(135deg, #CD7F32 0%, #E6A364 100%);
        color: var(--white);

        .athlete-name {
          color: var(--white);
        }

        .medal-rank {
          color: var(--white);
        }
      }
    }
  }

  .rankings-list {
    .list-title {
      font-size: var(--font-h4);
      font-weight: 600;
      margin-bottom: var(--spacing-lg);
      color: var(--dark);
    }

    .ranking-item {
      background: var(--white);
      border-radius: var(--radius-md);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-md);
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      box-shadow: var(--shadow-sm);

      .rank-number {
        flex-shrink: 0;

        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: 50%;
          font-weight: 600;
          font-size: var(--font-body);
        }
      }

      .rank-info {
        flex: 1;

        .athlete-name {
          font-size: var(--font-body);
          font-weight: 600;
          color: var(--dark);
          margin-bottom: var(--spacing-sm);
        }

        .rank-stats {
          display: flex;
          gap: var(--spacing-lg);
          flex-wrap: wrap;

          .stat {
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            font-size: var(--font-small);

            .label {
              color: var(--gray);
            }

            .value {
              color: var(--dark);
              font-weight: 600;
            }
          }
        }
      }

      .rank-points {
        flex-shrink: 0;
        font-size: var(--font-h4);
        font-weight: 600;
        color: var(--success);
        text-align: right;
      }
    }
  }
}

@media (min-width: 768px) {
  .rankings-page {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--spacing-2xl);
    padding-bottom: var(--spacing-2xl);
  }

  .rankings-content {
    padding: 0;
  }

  .filter-section {
    margin: 0;
    margin-bottom: var(--spacing-2xl);
  }
}
</style>
