<template>
  <div class="profile-page safe-area">
    <!-- 用户信息卡片 -->
    <div class="profile-card">
      <div class="profile-avatar">
        <span class="avatar-icon">👤</span>
      </div>
      <div class="profile-info">
        <h1>{{ userStore.userInfo.name }}</h1>
        <p class="phone">{{ userStore.userInfo.phone }}</p>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="statistics-section">
      <div class="section-title">统计信息</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-label">总成绩</div>
            <div class="stat-value">{{ scoresStore.totalScores }}</div>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <div class="stat-label">总积分</div>
            <div class="stat-value">{{ formatPoints(scoresStore.totalPoints) }}</div>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">🏆</div>
          <div class="stat-content">
            <div class="stat-label">最高排名</div>
            <div class="stat-value">{{ athleteAggregate?.best_rank || '-' }}</div>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">📈</div>
          <div class="stat-content">
            <div class="stat-label">平均排名</div>
            <div class="stat-value">{{ athleteAggregate?.average_rank ? formatNumber(athleteAggregate.average_rank, 1) : '-' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详细信息 -->
    <div class="details-section">
      <div class="section-title">个人信息</div>
      <div class="detail-list">
        <div class="detail-item">
          <span class="label">姓名</span>
          <span class="value">{{ userStore.userInfo.name }}</span>
        </div>
        <div class="detail-item">
          <span class="label">手机</span>
          <span class="value">{{ userStore.userInfo.phone }}</span>
        </div>
        <div class="detail-item">
          <span class="label">性别</span>
          <span class="value">{{ getGenderLabel(userStore.userInfo.gender) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">加入日期</span>
          <span class="value">{{ formatDate(userStore.userInfo.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 操作菜单 -->
    <div class="actions-section">
      <div class="section-title">操作</div>
      <div class="action-list">
        <button @click="editProfile" class="action-item">
          <span class="icon">✏️</span>
          <span class="text">编辑资料</span>
          <span class="arrow">›</span>
        </button>
        <button @click="changePassword" class="action-item">
          <span class="icon">🔐</span>
          <span class="text">修改密码</span>
          <span class="arrow">›</span>
        </button>
        <button @click="showAbout" class="action-item">
          <span class="icon">ℹ️</span>
          <span class="text">关于应用</span>
          <span class="arrow">›</span>
        </button>
        <button @click="logout" class="action-item danger">
          <span class="icon">🚪</span>
          <span class="text">退出登录</span>
          <span class="arrow">›</span>
        </button>
      </div>
    </div>

    <!-- 版本信息 -->
    <div class="version-info">
      <p>射箭赛事积分统计系统 v1.0.0</p>
      <p class="hint">© 2024 All Rights Reserved</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useScoresStore } from '@/stores/scores'
import { useRankingsStore } from '@/stores/rankings'
import { formatPoints, formatDate, getGenderLabel, formatNumber } from '@/utils/formatter'

const router = useRouter()
const userStore = useUserStore()
const scoresStore = useScoresStore()
const rankingsStore = useRankingsStore()

const athleteAggregate = ref(null)

const editProfile = () => {
  alert('编辑资料功能开发中...')
}

const changePassword = () => {
  alert('修改密码功能开发中...')
}

const showAbout = () => {
  alert('射箭赛事积分统计系统\n\nVersion 1.0.0\n\n一个专业的射箭赛事积分统计平台')
}

const logout = () => {
  if (confirm('确认退出登录?')) {
    userStore.logout()
    router.push('/login')
  }
}

onMounted(async () => {
  // 加载统计数据
  await scoresStore.fetchScores()
  
  // 加载运动员汇总信息
  if (userStore.userInfo.id) {
    athleteAggregate.value = await rankingsStore.fetchAthleteAggregate(userStore.userInfo.id)
  }
})
</script>

<style scoped lang="scss">
.profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding-bottom: var(--spacing-2xl);
  background: var(--light);
}

.profile-card {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: var(--white);
  padding: var(--spacing-2xl) var(--spacing-lg);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin: 0 var(--spacing-lg);

  .profile-avatar {
    flex-shrink: 0;

    .avatar-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      font-size: 32px;
    }
  }

  .profile-info {
    flex: 1;

    h1 {
      font-size: var(--font-h2);
      margin-bottom: var(--spacing-xs);
    }

    .phone {
      font-size: var(--font-small);
      opacity: 0.9;
    }
  }
}

.statistics-section,
.details-section,
.actions-section {
  padding: var(--spacing-lg);
  margin: 0 var(--spacing-lg);
  background: var(--white);
  border-radius: var(--radius-lg);

  .section-title {
    font-size: var(--font-h4);
    font-weight: 600;
    margin-bottom: var(--spacing-lg);
    color: var(--dark);
  }
}

.statistics-section {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-lg);
  }

  .stat-box {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: var(--light);
    border-radius: var(--radius-md);

    .stat-icon {
      font-size: 32px;
      flex-shrink: 0;
    }

    .stat-content {
      flex: 1;

      .stat-label {
        font-size: var(--font-xs);
        color: var(--gray);
        margin-bottom: var(--spacing-xs);
      }

      .stat-value {
        font-size: var(--font-h3);
        font-weight: 600;
        color: var(--primary);
      }
    }
  }
}

.details-section {
  .detail-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--gray-light);

    &:last-child {
      border-bottom: none;
    }

    .label {
      font-size: var(--font-small);
      color: var(--gray);
    }

    .value {
      font-size: var(--font-body);
      color: var(--dark);
      font-weight: 500;
    }
  }
}

.actions-section {
  .action-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: none;
    border: none;
    border-bottom: 1px solid var(--gray-light);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background: var(--light);
    }

    .icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .text {
      flex: 1;
      font-size: var(--font-body);
      color: var(--dark);
    }

    .arrow {
      color: var(--gray);
      font-size: var(--font-h3);
    }

    &.danger {
      .text {
        color: var(--danger);
      }
    }
  }
}

.version-info {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  color: var(--gray);

  p {
    font-size: var(--font-small);
    margin: var(--spacing-xs) 0;

    &.hint {
      font-size: var(--font-xs);
    }
  }
}

@media (min-width: 768px) {
  .profile-page {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--spacing-2xl);
  }

  .profile-card,
  .statistics-section,
  .details-section,
  .actions-section {
    margin: 0;
  }

  .statistics-section {
    .stats-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
}
</style>
