import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

const routerPush = vi.fn()
const eventListGet = vi.fn()
const eventRegistrationListGet = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    back: vi.fn(),
  }),
}))

vi.mock('@/api', () => ({
  dictionaryAPI: {
    getAll: vi.fn(async () => ({
      data: {
        bowTypes: [
          { code: 'recurve', name: '反曲弓' },
          { code: 'sightless', name: '无瞄弓' },
        ],
        distances: [
          { code: '18m', name: '18米' },
          { code: '10m', name: '10米' },
        ],
        competitionFormats: [],
        competitionGenderGroups: [
          { code: 'men', name: '男子组' },
          { code: 'women', name: '女子组' },
          { code: 'mixed', name: '混合组' },
        ],
        competitionGroups: [
          { group_code: 'B', bow_type: 'sightless', distance: '18m' },
          { group_code: 'C', bow_type: 'recurve', distance: '10m' },
        ],
      },
    })),
  },
  eventAPI: {
    getList: eventListGet,
    getDetail: vi.fn(),
    createWithConfigs: vi.fn(),
  },
  eventConfigAPI: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventRegistrationAPI: {
    getList: eventRegistrationListGet,
    batchImport: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('./EventRegistrationManagePanel.vue', () => ({
  default: {
    props: ['registrations', 'loading'],
    template: '<div data-test="registration-manage">报名数: {{ registrations.length }} / {{ loading }}</div>',
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

describe('EventAdd page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    eventListGet.mockResolvedValue({ items: [], total: 0 })
    eventRegistrationListGet.mockResolvedValue({
      items: [
        {
          id: 1,
          year: 2026,
          season: '春季赛',
          name: '张三',
          club: '甲俱乐部',
          distance: '18m',
          competition_bow_type: 'sightless',
          points_bow_type: 'barebow',
          competition_gender_group: 'mixed',
        },
      ],
      total: 1,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads registrations and reflects individual counts in readonly cells after selecting season', async () => {
    const { default: EventAdd } = await import('./EventAdd.vue')
    const view = await mountComponent(EventAdd)

    const seasonSelect = view.container.querySelector('#season')
    expect(seasonSelect).not.toBeNull()
    seasonSelect.value = '春季赛'
    seasonSelect.dispatchEvent(new Event('change'))
    await flushPromises(5)

    expect(eventRegistrationListGet).toHaveBeenCalled()
    expect(view.container.textContent).toContain('报名数: 1')

    const readonlyCells = Array.from(view.container.querySelectorAll('.readonly-cell')).map(node => node.textContent.trim())
    expect(readonlyCells).toContain('1')

    view.unmount()
  })
})
