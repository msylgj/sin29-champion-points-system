import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

const routerPush = vi.fn()
const annualRankingGet = vi.fn()
const eventYearsGet = vi.fn()
const xlsxAoaToSheet = vi.fn(data => ({ data }))
const xlsxBookNew = vi.fn(() => ({ sheets: [] }))
const xlsxBookAppendSheet = vi.fn((workbook, worksheet, name) => {
  workbook.sheets.push({ name, worksheet })
})
const xlsxWriteFile = vi.fn()

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: xlsxAoaToSheet,
    book_new: xlsxBookNew,
    book_append_sheet: xlsxBookAppendSheet,
  },
  writeFile: xlsxWriteFile,
}))

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

  it('exports selected event ranking with detail sheet', async () => {
    annualRankingGet.mockResolvedValue({
      athletes: [
        {
          ranking: 1,
          name: '张三',
          club: '甲俱乐部',
          total_points: 20,
          highlight: true,
          scores: [
            { event_id: 1, event_season: '2026 春季赛', bow_type: 'barebow', distance: '30m', format: 'ranking', rank: 1, points: 12 },
            { event_id: 1, event_season: '2026 春季赛', bow_type: 'barebow', distance: '18m', format: 'elimination', rank: 3, points: 5 },
            { event_id: 2, event_season: '2026 夏季赛', bow_type: 'barebow', distance: '30m', format: 'ranking', rank: 2, points: 8 },
          ],
        },
        {
          ranking: 2,
          name: '李四',
          club: '乙俱乐部',
          total_points: 18,
          highlight: true,
          scores: [
            { event_id: 1, event_season: '2026 春季赛', bow_type: 'barebow', distance: '30m', format: 'ranking', rank: 2, points: 10 },
            { event_id: 1, event_season: '2026 春季赛', bow_type: 'barebow', distance: '18m', format: 'elimination', rank: 4, points: 4 },
            { event_id: 2, event_season: '2026 夏季赛', bow_type: 'barebow', distance: '30m', format: 'ranking', rank: 1, points: 8 },
          ],
        },
      ],
    })

    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)

    view.container.querySelector('.btn-export').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises(3)

    const eventRadio = view.container.querySelector('input[value="event"]')
    eventRadio.checked = true
    eventRadio.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises(3)

    view.container.querySelector('.btn-export-confirm').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises(5)

    expect(xlsxWriteFile).toHaveBeenCalledTimes(1)
    const [workbook, filename] = xlsxWriteFile.mock.calls[0]
    expect(filename).toContain('春季赛')
    expect(workbook.sheets.map(sheet => sheet.name)).toEqual(['排名列表', '积分明细'])
    expect(workbook.sheets[0].worksheet.data).toEqual([
      ['排名', '姓名', '俱乐部', '积分', '参赛次数'],
      [1, '张三', '甲俱乐部', '17.0', 2],
      [2, '李四', '乙俱乐部', '14.0', 2],
    ])
    expect(workbook.sheets[1].worksheet.data).toEqual([
      ['排名', '姓名', '俱乐部', '总积分', '赛事', '弓种', '距离', '赛制', '名次', '积分'],
      [1, '张三', '甲俱乐部', '17.0', '2026 春季赛', '光弓', '30m', '排位赛', 1, '12.0'],
      [1, '张三', '甲俱乐部', '17.0', '2026 春季赛', '光弓', '18m', '淘汰赛', 3, '5.0'],
      [2, '李四', '乙俱乐部', '14.0', '2026 春季赛', '光弓', '30m', '排位赛', 2, '10.0'],
      [2, '李四', '乙俱乐部', '14.0', '2026 春季赛', '光弓', '18m', '淘汰赛', 4, '4.0'],
    ])
    expect(workbook.sheets[1].worksheet['!merges']).toEqual([
      { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 4, c: 4 } },
      { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
    ])

    view.unmount()
  })
})
