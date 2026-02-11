import { createRouter, createWebHistory } from 'vue-router'

// 新的三个主要页面
import EventAdd from '@/views/EventAdd.vue'
import ScoreImport from '@/views/ScoreImport.vue'
import PointsDisplay from '@/views/PointsDisplay.vue'

// 保留的其他页面（可选）
import Dashboard from '@/views/Dashboard.vue'
import Scores from '@/views/Scores.vue'
import ScoreForm from '@/views/ScoreForm.vue'
import Rankings from '@/views/Rankings.vue'
import Profile from '@/views/Profile.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: EventAdd,
    meta: { title: '赛事管理', icon: '📅', showBottomNav: true }
  },
  {
    path: '/event-add',
    name: 'EventAdd',
    component: EventAdd,
    meta: { title: '新增赛事', icon: '📅', showBottomNav: true }
  },
  {
    path: '/score-import',
    name: 'ScoreImport',
    component: ScoreImport,
    meta: { title: '导入成绩', icon: '📊', showBottomNav: true }
  },
  {
    path: '/points-display',
    name: 'PointsDisplay',
    component: PointsDisplay,
    meta: { title: '积分排名', icon: '🏆', showBottomNav: true }
  },
  // 保留的其他路由
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板', icon: '🏠', showBottomNav: false }
  },
  {
    path: '/scores',
    name: 'Scores',
    component: Scores,
    meta: { title: '成绩', icon: '📊', showBottomNav: false }
  },
  {
    path: '/scores/create',
    name: 'ScoreCreate',
    component: ScoreForm,
    meta: { title: '录入成绩', showBottomNav: false }
  },
  {
    path: '/scores/:id/edit',
    name: 'ScoreEdit',
    component: ScoreForm,
    meta: { title: '编辑成绩', showBottomNav: false }
  },
  {
    path: '/rankings',
    name: 'Rankings',
    component: Rankings,
    meta: { title: '排名', icon: '🏆', showBottomNav: false }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { title: '我的', icon: '👤', showBottomNav: false }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 路由导卫
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '射箭积分系统'
  next()
})

export default router
