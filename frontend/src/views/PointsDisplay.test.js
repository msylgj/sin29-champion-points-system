import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { adminAuthRequest, clearAdminAuthRequest, requestAdminAuthentication, saveAdminToken } from '@/utils/adminAuth'

const routerPush = vi.fn()
const annualRankingGet = vi.fn()
const eventYearsGet = vi.fn()
const adminLogin = vi.fn()
const encodeJwtPart = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (claims = {}) => [encodeJwtPart({ alg: 'HS256', typ: 'JWT' }), encodeJwtPart({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600, ...claims }), 'c2lnbmF0dXJl'].join('.')
const annualExport = vi.fn()
const seasonExport = vi.fn(async () => {})

vi.mock('@/utils/annualPointsExport', () => ({ exportAnnualPoints: annualExport }))
vi.mock('@/utils/seasonPointsExport', async importOriginal => ({
  ...await importOriginal(),
  exportSeasonPoints: seasonExport,
}))
vi.mock('xlsx', () => ({}))

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
    login: adminLogin,
  },
}))

const flushPromises = async (times = 3) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

const activeViews = new Set()
const mountComponent = async (component) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component)
  app.mount(container)
  await flushPromises(5)
  const view = {
    container,
    unmount: () => {
      if (!activeViews.delete(view)) return
      app.unmount()
      container.remove()
    },
  }
  activeViews.add(view)
  return view
}

describe('PointsDisplay page', () => {
  it('shows the authentication dialog on the first expired-session mount before ranking requests finish', async () => {
    localStorage.setItem('admin_auth_token', jwt({ exp: Math.floor(Date.now() / 1000) - 1 }))
    sessionStorage.setItem('admin_auth_required', '1')
    sessionStorage.setItem('admin_auth_redirect', '/scoring-rules?version=2#rules')
    eventYearsGet.mockImplementationOnce(() => new Promise(() => {}))
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    expect(view.container.querySelector('.auth-dialog')).not.toBeNull()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(adminAuthRequest.value.redirect).toBe('/scoring-rules?version=2#rules')
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('opens immediately when the mounted public page receives an authentication request and keeps the first return target', async () => {
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    expect(view.container.querySelector('.auth-dialog')).toBeNull()
    requestAdminAuthentication('/event-add?year=2026#config')
    await flushPromises()
    const password = view.container.querySelector('.auth-input')
    password.value = '管理口令'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    requestAdminAuthentication('/scoring-rules')
    await flushPromises()
    expect(view.container.querySelectorAll('.auth-dialog')).toHaveLength(1)
    expect(view.container.querySelector('.auth-input').value).toBe('管理口令')
    const fresh = jwt()
    adminLogin.mockResolvedValueOnce({ access_token: fresh })
    view.container.querySelector('.btn-auth-submit').click()
    await flushPromises()
    expect(localStorage.getItem('admin_auth_token')).toBe(fresh)
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-add?year=2026#config')
    expect(view.container.querySelector('.auth-dialog')).toBeNull()
    expect(adminAuthRequest.value).toBeNull()
  })

  it('keeps a wrong-password error in the dialog and returns to the original page after retry', async () => {
    requestAdminAuthentication('/scoring-rules?rule=3#config')
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    const password = view.container.querySelector('.auth-input')
    password.value = '错误口令'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    adminLogin.mockRejectedValueOnce({ detail: '管理密码错误', status: 401 })
    view.container.querySelector('.btn-auth-submit').click()
    await flushPromises()
    expect(view.container.querySelector('.auth-error').textContent).toBe('管理密码错误')
    expect(adminAuthRequest.value.redirect).toBe('/scoring-rules?rule=3#config')
    expect(routerPush).not.toHaveBeenCalled()
    adminLogin.mockResolvedValueOnce({ access_token: jwt() })
    view.container.querySelector('.btn-auth-submit').click()
    await flushPromises()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/scoring-rules?rule=3#config')
  })

  it('prevents duplicate login requests and dismissal while the password is being verified', async () => {
    let finish
    adminLogin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    requestAdminAuthentication('/score-import?event=8')
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    const password = view.container.querySelector('.auth-input')
    password.value = '口令'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    view.container.querySelector('.btn-auth-submit').click()
    view.container.querySelector('.btn-auth-submit').click()
    password.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(adminLogin).toHaveBeenCalledOnce()
    expect(view.container.querySelector('.btn-auth-cancel').disabled).toBe(true)
    view.container.querySelector('.auth-dialog-mask').click()
    await flushPromises()
    expect(view.container.querySelector('.auth-dialog')).not.toBeNull()
    finish({ access_token: jwt() })
    await flushPromises()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/score-import?event=8')
  })

  it('ignores a successful login response after this page has unmounted', async () => {
    let finish
    adminLogin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    requestAdminAuthentication('/event-add')
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    const password = view.container.querySelector('.auth-input')
    password.value = '口令'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    view.container.querySelector('.btn-auth-submit').click()
    await flushPromises()
    view.unmount()
    finish({ access_token: jwt() })
    await flushPromises()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('clears canceled reauthentication without reopening on the public page', async () => {
    requestAdminAuthentication('/event-add')
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    view.container.querySelector('.btn-auth-cancel').click()
    await flushPromises()
    expect(view.container.querySelector('.auth-dialog')).toBeNull()
    expect(adminAuthRequest.value).toBeNull()
    expect(sessionStorage.getItem('admin_auth_required')).toBeNull()
    expect(sessionStorage.getItem('admin_auth_redirect')).toBeNull()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('does not require a password for public rankings when only a stored token has expired', async () => {
    localStorage.setItem('admin_auth_token', jwt({ exp: 1 }))
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    expect(view.container.querySelector('.auth-dialog')).toBeNull()
    expect(localStorage.getItem('admin_auth_token')).toBeNull()
    expect(view.container.textContent).toContain('张三')
    view.container.querySelector('.btn-manage').click()
    await flushPromises()
    expect(view.container.querySelector('.auth-dialog')).not.toBeNull()
  })

  it('uses valid stored administrator credentials to navigate without an unnecessary prompt', async () => {
    saveAdminToken(jwt())
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    view.container.querySelector('.btn-manage').click()
    await flushPromises()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(view.container.querySelector('.auth-dialog')).toBeNull()
  })


  beforeEach(() => {
    vi.clearAllMocks()
    adminLogin.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    clearAdminAuthRequest()
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
    for (const view of [...activeViews]) view.unmount()
    clearAdminAuthRequest()
    localStorage.clear()
    sessionStorage.clear()
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

  it('exports only the selected season through the styled template', async () => {
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

    expect(annualExport).not.toHaveBeenCalled()
    expect(seasonExport).toHaveBeenCalledTimes(1)
    const options = seasonExport.mock.calls[0][1]
    expect(options.filename).toContain('春季赛')
    expect(options.eventLabel).toBe('春季赛')
    expect(options.eventId).toBe('1')
    expect(options.year).toBe(2026)
    expect(options.bowTypeLabel).toBe('光弓')
    expect(options.bowType).toBe('barebow')
    expect(options.ranking.map(({ ranking, name, total_points, scores }) => [ranking, name, total_points, scores.length])).toEqual([
      [1, '张三', 17, 2],
      [2, '李四', 14, 2],
    ])
    expect(options.ranking.every(athlete => athlete.scores.every(score => score.event_id === 1))).toBe(true)
    expect(view.container.querySelector('.export-dialog')).toBeNull()

    view.unmount()
  })

  it('passes the bow theme, all station columns and filtered athletes to the annual export', async () => {
    annualRankingGet.mockResolvedValue({ athletes: [
      { ranking: 1, name: '张三', club: '甲俱乐部', total_points: 20, scores: [
        { event_id: 2, event_season: '2026 夏季赛', distance: '30m', format: 'ranking', rank: 1, points: 20 },
      ] },
      { ranking: 2, name: '李四', club: '乙俱乐部', total_points: 9, scores: [
        { event_id: 1, event_season: '2026 春季赛', distance: '30m', format: 'ranking', rank: 2, points: 9 },
      ] },
    ] })
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    const club = view.container.querySelector('#club-filter')
    club.value = '甲俱乐部'
    club.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    view.container.querySelector('.btn-export').click()
    await flushPromises()
    view.container.querySelector('.btn-export-confirm').click()
    await flushPromises(5)

    expect(seasonExport).not.toHaveBeenCalled()
    expect(annualExport).toHaveBeenCalledOnce()
    const options = annualExport.mock.calls[0][1]
    expect(options.filename).toContain('_年度总积分_甲俱乐部.xlsx')
    expect(options).toMatchObject({ year: 2026, bowType: 'barebow', bowTypeLabel: '光弓' })
    expect(options.events.map(event => [event.value, event.shortLabel])).toEqual([['1', '春季赛'], ['2', '夏季赛']])
    expect(options.ranking.map(athlete => athlete.name)).toEqual(['张三'])

    expect(view.container.querySelector('.export-dialog')).toBeNull()
    view.unmount()
  })

  it('uses decimal tenths for season sorting and honors club filters', async () => {
    annualRankingGet.mockResolvedValue({ athletes: [
      { ranking: 1, name: 'Z', club: '甲', total_points: 1.6, scores: [
        { event_id: 1, event_season: '2026 春季赛', distance: '30m', format: 'ranking', points: 0.6 },
        { event_id: 2, event_season: '2026 夏季赛', distance: '30m', format: 'ranking', points: 1 },
      ] },
      { ranking: 2, name: 'A', club: '乙', total_points: 0.6, scores: [
        { event_id: 1, event_season: '2026 春季赛', distance: '30m', format: 'ranking', points: 0.24 },
        { event_id: 1, event_season: '2026 春季赛', distance: '18m', format: 'team', points: 0.24 },
        { event_id: 1, event_season: '2026 春季赛', distance: '10m', format: 'elimination', points: 0.24 },
      ] },
    ] })
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    view.container.querySelector('.btn-export').click()
    await flushPromises()
    const radio = view.container.querySelector('input[value="event"]')
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    view.container.querySelector('.btn-export-confirm').click()
    await flushPromises(5)
    expect(seasonExport.mock.calls[0][1].ranking.map(item => [item.name, item.total_points, item.ranking])).toEqual([['A', 0.6, 1], ['Z', 0.6, 2]])

    const club = view.container.querySelector('#club-filter')
    club.value = '甲'
    club.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    view.container.querySelector('.btn-export').click()
    await flushPromises()
    const filteredRadio = view.container.querySelector('input[value="event"]')
    filteredRadio.checked = true
    filteredRadio.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    view.container.querySelector('.btn-export-confirm').click()
    await flushPromises(5)
    expect(seasonExport.mock.calls[1][1].ranking.map(item => [item.name, item.ranking])).toEqual([['Z', 2]])
    expect(seasonExport.mock.calls[1][1].filename).toContain('_甲.xlsx')
    view.unmount()
  })

  it('reports template export failures without closing the dialog', async () => {
    seasonExport.mockRejectedValueOnce(new Error('赛季导出模板加载失败，请重试'))
    const { default: PointsDisplay } = await import('./PointsDisplay.vue')
    const view = await mountComponent(PointsDisplay)
    view.container.querySelector('.btn-export').click()
    await flushPromises()
    const radio = view.container.querySelector('input[value="event"]')
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    view.container.querySelector('.btn-export-confirm').click()
    await flushPromises(5)
    expect(view.container.textContent).toContain('赛季导出模板加载失败，请重试')
    expect(view.container.querySelector('.export-dialog')).not.toBeNull()
    expect(annualExport).not.toHaveBeenCalled()
    view.unmount()
  })
})
