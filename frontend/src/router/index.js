import { createRouter, createWebHistory } from 'vue-router'

// 新的三个主要页面
import EventAdd from '@/views/EventAdd.vue'
import ScoreImport from '@/views/ScoreImport.vue'
import PointsDisplay from '@/views/PointsDisplay.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: PointsDisplay,
    meta: { title: '积分排名', icon: '🏆', showBottomNav: true }
  },
  {
    path: '/points-display',
    name: 'PointsDisplay',
    component: PointsDisplay,
    meta: { title: '积分排名', icon: '🏆', showBottomNav: true }
  },
  {
    path: '/event-add',
    name: 'EventAdd',
    component: EventAdd,
    meta: { title: '赛事配置', icon: '📅', showBottomNav: true }
  },
  {
    path: '/score-import',
    name: 'ScoreImport',
    component: ScoreImport,
    meta: { title: '导入成绩', icon: '📊', showBottomNav: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '射箭积分系统'
  next()
})

export default router
