import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

const routerPush = vi.fn()
const scoreListGet = vi.fn()
const eventListGet = vi.fn()
const eventDetailGet = vi.fn()
const registrationListGet = vi.fn()

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
          { code: 'recurve', name: '反曲弓' },
        ],
        distances: [
          { code: '30m', name: '30米' },
        ],
        competitionFormats: [
          { code: 'ranking', name: '排位赛' },
        ],
        competitionGenderGroups: [
          { code: 'men', name: '男子组' },
          { code: 'women', name: '女子组' },
          { code: 'mixed', name: '混合组' },
        ],
        competitionGroups: [
          { group_code: 'A', bow_type: 'recurve', distance: '30m' },
        ],
      },
    })),
  },
  eventAPI: {
    getList: eventListGet,
    getDetail: eventDetailGet,
    getYears: vi.fn(),
    createWithConfigs: vi.fn(),
  },
  eventRegistrationAPI: {
    getList: registrationListGet,
  },
  scoreAPI: {
    getList: scoreListGet,
    batchImport: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getAnnualRanking: vi.fn(),
  },
  authAPI: {
    login: vi.fn(),
  },
}))

vi.mock('./ScoreManagePanel.vue', () => ({
  default: {
    template: '<div data-test="score-manage-panel">{{ JSON.stringify(scores) }}</div>',
    props: ['scores', 'loading', 'bowTypes', 'distances', 'competitionFormats', 'competitionGenderGroups'],
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

describe('ScoreImport page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    eventListGet.mockResolvedValue({
      items: [
        { id: 1, year: 2025, season: '冬季赛' },
        { id: 2, year: 2026, season: '夏季赛' },
      ],
      total: 2,
    })
    eventDetailGet.mockResolvedValue({
      id: 2,
      year: 2026,
      season: '夏季赛',
      configurations: [
        {
          gender_group: 'men',
          bow_type: 'recurve',
          distance: '30m',
          individual_participant_count: 8,
          mixed_doubles_team_count: 0,
          team_count: 0,
        },
      ],
    })
    registrationListGet.mockResolvedValue({ items: [], total: 0 })
    scoreListGet.mockResolvedValue({ items: [], total: 0 })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads the latest event and shows excel-only upload help', async () => {
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport)

    const eventSelect = view.container.querySelector('#event-select')
    expect(eventSelect).not.toBeNull()
    expect(String(eventSelect.value)).toBe('2')
    expect(view.container.textContent).toContain('选择 Excel 文件')
    expect(view.container.textContent).not.toContain('CSV')
    expect(registrationListGet).toHaveBeenCalled()
    expect(scoreListGet).toHaveBeenCalled()

    view.unmount()
  })

  it('passes gender_group from loaded scores into the manage panel', async () => {
    scoreListGet.mockResolvedValue({
      items: [
        {
          id: 11,
          event_id: 2,
          name: '张三',
          bow_type: 'recurve',
          distance: '30m',
          format: 'ranking',
          gender_group: 'men',
          rank: 1,
        },
      ],
      total: 1,
    })

    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport)

    expect(view.container.textContent).toContain('"gender_group":"men"')

    view.unmount()
  })
})
