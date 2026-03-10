import { createRouter, createWebHistory } from 'vue-router'

const EventAdd = () => import('@/views/EventAdd.vue')
const ScoreImport = () => import('@/views/ScoreImport.vue')
const PointsDisplay = () => import('@/views/PointsDisplay.vue')

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
    meta: { title: '赛事配置', icon: '📅', showBottomNav: true, requiresAdminAuth: true }
  },
  {
    path: '/score-import',
    name: 'ScoreImport',
    component: ScoreImport,
    meta: { title: '导入成绩', icon: '📊', showBottomNav: true, requiresAdminAuth: true }
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

  const adminToken = localStorage.getItem('admin_auth_token')
  if (to.meta.requiresAdminAuth && !adminToken) {
    next({
      path: '/points-display',
      query: {
        authRequired: '1',
        redirect: to.fullPath
      }
    })
    return
  }

  next()
})

export default router
