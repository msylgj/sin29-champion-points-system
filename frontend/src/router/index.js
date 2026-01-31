import { createRouter, createWebHistory } from 'vue-router'

// 页面组件
import Dashboard from '@/views/Dashboard.vue'
import Scores from '@/views/Scores.vue'
import ScoreForm from '@/views/ScoreForm.vue'
import Rankings from '@/views/Rankings.vue'
import Profile from '@/views/Profile.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { title: '仪表板', icon: '🏠', showBottomNav: true }
  },
  {
    path: '/scores',
    name: 'Scores',
    component: Scores,
    meta: { title: '成绩', icon: '📊', showBottomNav: true }
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
    meta: { title: '排名', icon: '🏆', showBottomNav: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { title: '我的', icon: '👤', showBottomNav: true }
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
