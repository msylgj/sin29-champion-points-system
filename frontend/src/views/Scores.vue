<template>
  <div class="scores-page safe-area">
    <!-- 筛选器 -->
    <div class="filter-section">
      <div class="filter-title">筛选</div>
      <div class="filter-row">
        <select v-model="filters.year" class="filter-input" @change="onFilterChange">
          <option value="">年度</option>
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
        <select v-model="filters.season" class="filter-input" @change="onFilterChange">
          <option value="">季度</option>
          <option value="Q1">Q1</option>
          <option value="Q2">Q2</option>
          <option value="Q3">Q3</option>
          <option value="Q4">Q4</option>
        </select>
      </div>
      <div class="filter-row">
        <select v-model="filters.distance" class="filter-input" @change="onFilterChange">
          <option value="">距离</option>
          <option value="18m">18m</option>
          <option value="30m">30m</option>
          <option value="50m">50m</option>
          <option value="70m">70m</option>
        </select>
        <select v-model="filters.competition_format" class="filter-input" @change="onFilterChange">
          <option value="">赛制</option>
          <option value="ranking">排名赛</option>
          <option value="elimination">淘汰赛</option>
          <option value="team">团体赛</option>
        </select>
      </div>
    </div>

    <!-- 成绩统计 -->
    <div class="stats-bar">
      <div class="stat">
        <span class="label">成绩数:</span>
        <span class="value">{{ scoresStore.totalScores }}</span>
      </div>
      <div class="stat">
        <span class="label">总积分:</span>
        <span class="value">{{ formatPoints(scoresStore.totalPoints) }}</span>
      </div>
    </div>

    <!-- 成绩列表 -->
    <div class="scores-list-section">
      <div v-if="scoresStore.loading" class="loading">加载中...</div>
      <div v-else-if="scoresStore.scores.length === 0" class="empty">
        <p>暂无成绩数据</p>
        <router-link to="/scores/create" class="btn-primary">立即录入</router-link>
      </div>
      <div v-else class="scores-list">
        <div v-for="score in scoresStore.scores" :key="score.id" class="score-card">
          <div class="score-header">
            <div class="score-title">
              <span class="distance-tag">{{ score.distance }}</span>
              <span class="format-tag">{{ getFormatLabel(score.competition_format) }}</span>
            </div>
            <div class="score-rank">
              <span class="rank-badge">{{ formatRank(score.rank) }}</span>
            </div>
          </div>
          <div class="score-body">
            <div class="score-info">
              <div class="info-item">
                <span class="label">原始成绩:</span>
                <span class="value">{{ score.raw_score }}</span>
              </div>
              <div class="info-item">
                <span class="label">参赛人数:</span>
                <span class="value">{{ score.participant_count }}</span>
              </div>
            </div>
            <div class="score-points">
              <span class="points-label">积分</span>
              <span class="points-value">{{ formatPoints(score.points) }}</span>
            </div>
          </div>
          <div class="score-footer">
            <span class="date">{{ formatDate(score.created_at) }}</span>
            <div class="actions">
              <router-link :to="`/scores/${score.id}/edit`" class="action-link">编辑</router-link>
              <button @click="deleteScore(score.id)" class="action-link danger">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 悬浮按钮 -->
    <router-link to="/scores/create" class="fab">
      <span>➕</span>
    </router-link>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScoresStore } from '@/stores/scores'
import { formatPoints, formatDate, getFormatLabel, formatRank } from '@/utils/formatter'

const scoresStore = useScoresStore()

const years = computed(() => {
  const year = new Date().getFullYear()
  return [year - 2, year - 1, year, year + 1]
})

const filters = ref({
  year: new Date().getFullYear().toString(),
  season: null,
  distance: null,
  competition_format: null
})

const onFilterChange = async () => {
  await scoresStore.setFilters({
    year: filters.value.year ? parseInt(filters.value.year) : null,
    season: filters.value.season,
    distance: filters.value.distance,
    competition_format: filters.value.competition_format
  })
  await scoresStore.fetchScores()
}

const deleteScore = async (id) => {
  if (confirm('确认删除此成绩?')) {
    await scoresStore.deleteScore(id)
  }
}

onMounted(async () => {
  await scoresStore.fetchScores()
})
</script>

<style scoped lang="scss">
.scores-page {
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}

.filter-section {
  background: var(--white);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);

  .filter-title {
    font-size: var(--font-small);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--dark);
  }

  .filter-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .filter-input {
    padding: var(--spacing-md);
    border: 1px solid var(--gray-light);
    border-radius: var(--radius-md);
    font-size: var(--font-small);
    background: var(--light);
  }
}

.stats-bar {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--primary-light);
  margin-bottom: var(--spacing-md);

  .stat {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);

    .label {
      font-size: var(--font-small);
      color: var(--dark-gray);
    }

    .value {
      font-size: var(--font-h4);
      font-weight: 600;
      color: var(--primary);
    }
  }
}

.scores-list-section {
  padding: 0 var(--spacing-lg);

  .loading,
  .empty {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--gray);

    p {
      margin-bottom: var(--spacing-lg);
    }

    .btn-primary {
      display: inline-block;
      background: var(--primary);
      color: var(--white);
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--radius-md);
      text-decoration: none;
    }
  }

  .scores-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .score-card {
    background: var(--white);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);

    .score-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--gray-light);

      .score-title {
        display: flex;
        gap: var(--spacing-sm);

        .distance-tag,
        .format-tag {
          font-size: var(--font-xs);
          padding: 4px 8px;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: var(--radius-sm);
        }
      }

      .score-rank {
        .rank-badge {
          font-size: var(--font-body);
          font-weight: 600;
        }
      }
    }

    .score-body {
      padding: var(--spacing-lg);
      display: flex;
      justify-content: space-between;
      align-items: center;

      .score-info {
        flex: 1;

        .info-item {
          display: flex;
          gap: var(--spacing-md);
          font-size: var(--font-small);
          margin-bottom: var(--spacing-sm);

          .label {
            color: var(--gray);
          }

          .value {
            color: var(--dark);
            font-weight: 600;
          }
        }
      }

      .score-points {
        text-align: right;
        margin-left: var(--spacing-lg);

        .points-label {
          display: block;
          font-size: var(--font-xs);
          color: var(--gray);
          margin-bottom: var(--spacing-xs);
        }

        .points-value {
          display: block;
          font-size: var(--font-h2);
          color: var(--success);
          font-weight: 600;
        }
      }
    }

    .score-footer {
      padding: var(--spacing-lg);
      background: var(--light);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--gray-light);

      .date {
        font-size: var(--font-xs);
        color: var(--gray);
      }

      .actions {
        display: flex;
        gap: var(--spacing-lg);

        .action-link {
          font-size: var(--font-xs);
          color: var(--primary);
          text-decoration: none;
          border: none;
          background: none;
          cursor: pointer;

          &.danger {
            color: var(--danger);
          }
        }
      }
    }
  }
}

.fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  text-decoration: none;
  box-shadow: var(--shadow-lg);
  z-index: 10;

  &:active {
    transform: scale(0.95);
  }
}

@media (min-width: 768px) {
  .scores-page {
    max-width: 900px;
    margin: 0 auto;
    padding-bottom: var(--spacing-2xl);
  }

  .filter-section {
    margin: 0;
  }

  .scores-list-section {
    padding: 0;
  }

  .fab {
    bottom: 40px;
    right: 40px;
  }
}
</style>
