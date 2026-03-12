import { createRouter, createWebHistory } from 'vue-router'

const INTERNAL_ROUTE_KEY = 'internal_route_full_path'

const EventAdd = () => import('@/views/EventAdd.vue')
const ScoreImport = () => import('@/views/ScoreImport.vue')
const PointsDisplay = () => import('@/views/PointsDisplay.vue')

const routes = [
  {
    path: '/',
    name: 'Home',
    component: PointsDisplay,
    meta: { title: '积分排名' }
  },
  {
    path: '/points-display',
    name: 'PointsDisplay',
    component: PointsDisplay,
    meta: { title: '积分排名' }
  },
  {
    path: '/event-add',
    name: 'EventAdd',
    component: EventAdd,
    meta: { title: '赛事配置', requiresAdminAuth: true }
  },
  {
    path: '/score-import',
    name: 'ScoreImport',
    component: ScoreImport,
    meta: { title: '导入成绩', requiresAdminAuth: true }
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
    sessionStorage.setItem('admin_auth_required', '1')
    sessionStorage.setItem('admin_auth_redirect', to.fullPath)
    next({
      path: '/points-display'
    })
    return
  }

  next()
})

router.afterEach((to) => {
  sessionStorage.setItem(INTERNAL_ROUTE_KEY, to.fullPath)
})

export default router
