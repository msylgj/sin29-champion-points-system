import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

const routerPush = vi.fn()
const annualRankingGet = vi.fn()
const eventYearsGet = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
  useRoute: () => ({
    query: {},
  }),
}))

vi.mock('@/api', () => ({
  dictionaryAPI: {
    getAll: vi.fn(async () => ({
      data: {
        bowTypes: [
          { code: 'barebow', name: '光弓' },
          { code: 'sightless', name: '无瞄弓' },
          { code: 'recurve', name: '反曲弓' },
        ],
        distances: [],
        competitionFormats: [],
        competitionGenderGroups: [],
        competitionGroups: [],
      },
    })),
  },
  scoreAPI: {
    getAnnualRanking: annualRankingGet,
  },
  eventAPI: {
    getYears: eventYearsGet,
  },
  authAPI: {
    login: vi.fn(),
  },
}))

const flushPromises = async (times = 3) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

const mountComponent = async (component) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component)
  app.mount(container)
  await flushPromises(5)
  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('PointsDisplay page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    eventYearsGet.mockResolvedValue({ items: [2026, 2025] })
    annualRankingGet.mockResolvedValue({
      athletes: [
        {
          ranking: 1,
          name: '张三',
          club: '甲俱乐部',
          total_points: 20,
          highlight: true,
          scores: [
            { event_id: 1, event_season: '2026 夏季赛', distance: '30m', format: 'ranking', rank: 1, points: 20 },
          ],
        },
      ],
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('filters sightless bow type out of ranking select and renders ranking data', async () => {
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)

    const bowSelect = view.container.querySelector('#bow-type-select')
    expect(bowSelect).not.toBeNull()
    const optionTexts = Array.from(bowSelect.querySelectorAll('option')).map(node => node.textContent.trim())
    expect(optionTexts).toContain('光弓')
    expect(optionTexts).toContain('反曲弓')
    expect(optionTexts).not.toContain('无瞄弓')
    expect(view.container.textContent).toContain('张三')
    expect(view.container.textContent).toContain('20.0')

    view.unmount()
  })
})
