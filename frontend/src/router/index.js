import { createRouter, createWebHistory } from 'vue-router'
import { getValidAdminToken, markAdminAuthenticationRequired, registerAdminAuthRouter } from '@/utils/adminAuth'

const EventList = () => import('@/views/EventList.vue')
const eventProps = route => ({ managedEventId: route.query.event_id })
const EventAdd = () => import('@/views/EventAdd.vue')
const ScoreImport = () => import('@/views/ScoreImport.vue')
const ScoringRules = () => import('@/views/ScoringRules.vue')
const WorkWizard = () => import('@/views/WorkWizard.vue')
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
    path: '/event-list',
    name: 'EventList',
    component: EventList,
    meta: { title: '赛事清单', requiresAdminAuth: true }
  },
  {
    path: '/event-add',
    name: 'EventAdd',
    component: EventAdd,
    props: eventProps,
    meta: { title: '赛事配置', requiresAdminAuth: true, keyedByEvent: true }
  },
  {
    path: '/scoring-rules',
    name: 'ScoringRules',
    component: ScoringRules,
    meta: { title: '积分规则管理', requiresAdminAuth: true }
  },
  {
    path: '/work-wizard',
    name: 'WorkWizard',
    component: WorkWizard,
    meta: { title: '成绩导入向导', requiresAdminAuth: true }
  },
  {
    path: '/score-import',
    name: 'ScoreImport',
    component: ScoreImport,
    props: eventProps,
    meta: { title: '导入成绩', requiresAdminAuth: true, keyedByEvent: true }
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
