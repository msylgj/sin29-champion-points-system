import { createRouter, createWebHistory } from 'vue-router'
import { getValidAdminToken, markAdminAuthenticationRequired, registerAdminAuthRouter } from '@/utils/adminAuth'

const EventAdd = () => import('@/views/EventAdd.vue')
const ScoreImport = () => import('@/views/ScoreImport.vue')
const ScoringRules = () => import('@/views/ScoringRules.vue')
const PointsDisplay = () => import('@/views/PointsDisplay.vue')

const routes = [
  {
    path: '/',
    redirect: '/points-display'
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
    path: '/scoring-rules',
    name: 'ScoringRules',
    component: ScoringRules,
    meta: { title: '积分规则管理', requiresAdminAuth: true }
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

registerAdminAuthRouter(router)

router.beforeEach(to => {
  document.title = to.meta.title || '射箭积分系统'

  if (to.meta.requiresAdminAuth && !getValidAdminToken()) {
    markAdminAuthenticationRequired(to.fullPath)
    return { path: '/points-display', replace: true }
  }
})

export default router
