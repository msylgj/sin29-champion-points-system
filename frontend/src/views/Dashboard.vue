<template>
  <div class="dashboard-page safe-area">
    <!-- 顶部欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-header">
        <h1>欢迎回来</h1>
        <p>{{ userStore.userInfo.name }}</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-label">总参赛次数</div>
        <div class="stat-value">{{ scoresStore.totalScores }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总积分</div>
        <div class="stat-value">{{ formatPoints(scoresStore.totalPoints) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">当前排名</div>
        <div class="stat-value">{{ rankingsStore.myRank || '-' }}</div>
      </div>
    </div>

    <!-- 快速操作 -->
    <div class="quick-actions">
      <div class="action-title">快速操作</div>
      <div class="action-buttons">
        <router-link to="/scores/create" class="action-btn">
          <span class="icon">➕</span>
          <span>录入成绩</span>
        </router-link>
        <router-link to="/rankings" class="action-btn">
          <span class="icon">🏆</span>
          <span>查看排名</span>
        </router-link>
        <router-link to="/scores" class="action-btn">
          <span class="icon">📊</span>
          <span>我的成绩</span>
        </router-link>
      </div>
    </div>

    <!-- 最近成绩 -->
    <div class="recent-scores">
      <div class="section-title">最近成绩</div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="recentScores.length === 0" class="empty">
        <p>暂无成绩</p>
      </div>
      <div v-else class="scores-list">
        <div v-for="score in recentScores" :key="score.id" class="score-item">
          <div class="score-info">
            <div class="score-header">
              <span class="distance">{{ score.distance }}</span>
              <span class="format">{{ getFormatLabel(score.competition_format) }}</span>
            </div>
            <div class="score-details">
              <span class="rank">排名: #{{ score.rank }}</span>
              <span class="points">{{ formatPoints(score.points) }} 分</span>
            </div>
          </div>
          <div class="score-date">
            {{ formatDate(score.created_at) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useScoresStore } from '@/stores/scores'
import { useRankingsStore } from '@/stores/rankings'
import { formatPoints, formatDate, getFormatLabel } from '@/utils/formatter'

const router = useRouter()
const userStore = useUserStore()
const scoresStore = useScoresStore()
const rankingsStore = useRankingsStore()

const loading = ref(false)

const recentScores = computed(() => {
  return scoresStore.scores.slice(0, 5)
})

onMounted(async () => {
  loading.value = true
  try {
    // 获取用户成绩
    await scoresStore.fetchScores()
    
    // 获取排名信息
    await rankingsStore.fetchRankings()
    
    // 获取运动员汇总
    if (userStore.userInfo.id) {
      await rankingsStore.fetchAthleteAggregate(userStore.userInfo.id)
    }
  } catch (error) {
    console.error('获取数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding-bottom: var(--spacing-2xl);
}

.welcome-section {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: var(--white);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  margin: 0 var(--spacing-lg);
}

.welcome-header {
  h1 {
    font-size: var(--font-h2);
    margin-bottom: var(--spacing-xs);
  }

  p {
    font-size: var(--font-body);
    opacity: 0.9;
  }
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg);
}

.stat-card {
  background: var(--white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  text-align: center;
  box-shadow: var(--shadow-sm);

  .stat-label {
    font-size: var(--font-small);
    color: var(--dark-gray);
    margin-bottom: var(--spacing-sm);
  }

  .stat-value {
    font-size: var(--font-h3);
    font-weight: 600;
    color: var(--primary);
  }
}

.quick-actions {
  padding: 0 var(--spacing-lg);

  .action-title {
    font-size: var(--font-h4);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
  }

  .action-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-md);
  }

  .action-btn {
    background: var(--white);
    border: 2px solid var(--gray-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
    transition: all 0.3s;

    .icon {
      font-size: 24px;
    }

    span:last-child {
      font-size: var(--font-small);
      color: var(--dark);
    }

    &:active {
      border-color: var(--primary);
      background-color: var(--primary-light);
    }
  }
}

.recent-scores {
  padding: 0 var(--spacing-lg);

  .section-title {
    font-size: var(--font-h4);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
  }

  .loading,
  .empty {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--gray);
  }

  .scores-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .score-item {
    background: var(--white);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-sm);

    .score-info {
      flex: 1;
    }

    .score-header {
      display: flex;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-sm);

      .distance,
      .format {
        font-size: var(--font-small);
        background: var(--primary-light);
        color: var(--primary);
        padding: 2px 8px;
        border-radius: var(--radius-sm);
      }
    }

    .score-details {
      display: flex;
      gap: var(--spacing-lg);
      font-size: var(--font-small);
      color: var(--dark-gray);

      .points {
        color: var(--success);
        font-weight: 600;
      }
    }

    .score-date {
      font-size: var(--font-xs);
      color: var(--gray);
      text-align: right;
    }
  }
}

@media (min-width: 768px) {
  .dashboard-page {
    padding: var(--spacing-2xl);
    max-width: 900px;
    margin: 0 auto;
  }

  .stats-container {
    padding: 0;
  }

  .quick-actions,
  .recent-scores {
    padding: 0;
  }
}
</style>
