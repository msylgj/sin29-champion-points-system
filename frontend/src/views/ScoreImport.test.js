import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import * as XLSX from 'xlsx'

const routerPush = vi.fn()
const scoreListGet = vi.fn()
const eventListGet = vi.fn()
const eventDetailGet = vi.fn()
const registrationListGet = vi.fn()
const scoreBatchImport = vi.fn()

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
    batchImport: scoreBatchImport,
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

const mountComponent = async (component, props = {}) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const complete = vi.fn()
  const busy = vi.fn()
  const app = createApp(component, { ...props, onComplete: complete, onBusyChange: busy })
  app.mount(container)
  await flushPromises(5)
  return {
    container, complete, busy,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

const wizardEvent = { id: 1, year: 2025, season: '冬季赛' }
const savedScore = (id = 11, name = '张三') => ({ id, event_id: 1, name, bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men', rank: 1 })
const registration = (id = 1, name = '张三') => ({ id, name, competition_bow_type: 'recurve', points_bow_type: 'recurve', distance: '30m', competition_gender_group: 'men', club: '甲俱乐部' })
const managedDetail = (id = 1) => ({ ...wizardEvent, id, configurations: [{ gender_group: 'men', bow_type: 'recurve', distance: '30m', individual_participant_count: 8, team_count: 0, mixed_doubles_team_count: 0 }] })
const boundRegistration = (id = 1, name = '张三') => ({ ...registration(id, name), year: wizardEvent.year, season: wizardEvent.season })
const bindFixtures = () => {
  eventDetailGet.mockResolvedValue(managedDetail())
  registrationListGet.mockResolvedValue({ items: [boundRegistration()], total: 1 })
  scoreListGet.mockResolvedValue({ items: [savedScore()], total: 1 })
}
const validRows = [['姓名', '弓种', '距离', '赛制', '排名'], ['张三', '反曲弓', '30m', '排位赛', 1]]
const chooseFile = async (view, rows = validRows, fileOverride = null) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  const file = fileOverride || new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], '成绩.xlsx')
  const input = view.container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises(5)
}

describe('ScoreImport page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerPush.mockReset().mockResolvedValue(undefined)
    document.body.innerHTML = ''
    scoreBatchImport.mockReset().mockResolvedValue([{ id: 11 }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    eventListGet.mockReset().mockResolvedValue({
      items: [
        { id: 1, year: 2025, season: '冬季赛' },
        { id: 2, year: 2026, season: '夏季赛' },
      ],
      total: 2,
    })
    eventDetailGet.mockReset().mockResolvedValue({
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
    registrationListGet.mockReset().mockResolvedValue({ items: [], total: 0 })
    scoreListGet.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('returns to the event list rather than exposing standalone creation or rule shortcuts', async () => {
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport)
    expect(view.container.querySelector('[data-test=scoring-rules-link]')).toBeNull()
    view.container.querySelector('.btn-add-event').click()
    expect(routerPush).toHaveBeenCalledWith('/event-list')
    view.unmount()
  })


  it('guides an empty ordinary entry back to the event list without a wizard or create shortcut', async () => {
    eventListGet.mockResolvedValue({ items: [], total: 0 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport)
    expect(view.container.querySelector('[data-test=work-wizard-entry]')).toBeNull()
    expect(view.container.textContent).toContain('当前无赛事记录')
    view.container.querySelector('.no-events-tip button').click()
    expect(routerPush).toHaveBeenCalledWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('locks the wizard event and hides unrelated header selection configuration and editing', async () => {
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    for (const selector of ['.page-header', '#event-select', '.event-info', '[data-test=score-manage-panel]', '[data-test=work-wizard-entry]']) expect(view.container.querySelector(selector)).toBeNull()
    expect(view.container.querySelector('[data-test=wizard-locked-event]').textContent).toContain('2025 冬季赛')
    expect(view.container.querySelector('.score-import-page').classList.contains('wizard-mode')).toBe(true)
    expect(eventListGet).not.toHaveBeenCalled()
    expect(eventDetailGet).not.toHaveBeenCalled()
    expect(registrationListGet).toHaveBeenCalledWith({ page: 1, page_size: 100, year: 2025, season: '冬季赛' })
    expect(scoreListGet).toHaveBeenCalledWith({ page: 1, page_size: 100, event_id: 1 })
    expect(view.busy).toHaveBeenCalledWith(true)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('loads all registration and saved-score pages before parsing and saving a real workbook', async () => {
    registrationListGet.mockImplementation(async ({ page }) => ({ total: 101, items: page === 1 ? Array.from({ length: 100 }, (_, i) => registration(i + 1, '其他' + i)) : [registration(101)] }))
    scoreListGet.mockImplementation(async ({ page }) => ({ total: 101, items: page === 1 ? Array.from({ length: 100 }, (_, i) => savedScore(i + 1, '其他' + i)) : [savedScore(101)] }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    expect(registrationListGet).toHaveBeenCalledWith({ page: 2, page_size: 100, year: 2025, season: '冬季赛' })
    expect(scoreListGet).toHaveBeenCalledWith({ page: 2, page_size: 100, event_id: 1 })
    expect(view.container.querySelector('[data-test=wizard-use-existing]').textContent).toContain('101条')
    view.busy.mockClear()
    await chooseFile(view)
    expect(view.container.textContent).toContain('合法 1 / 异常 0')
    expect(view.container.textContent).toContain('重复（将覆盖）')
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(true)
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).toHaveBeenCalledWith(true)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(scoreBatchImport).toHaveBeenCalledExactlyOnceWith({ scores: [{ event_id: 1, name: '张三', bow_type: 'recurve', distance: '30m', format: 'ranking', gender_group: 'men', rank: 1 }] })
    expect(view.complete).toHaveBeenCalledOnce()
    expect(view.busy).toHaveBeenLastCalledWith(false)
    view.unmount()
  })

  it.each(['registrations', 'scores'])('blocks upload and completion after a failed second %s page until explicit retry', async kind => {
    const loader = kind === 'registrations' ? registrationListGet : scoreListGet
    const record = kind === 'registrations' ? registration : savedScore
    loader.mockImplementation(async ({ page }) => {
      if (page === 2) throw new Error('第二页失败')
      return { total: 101, items: Array.from({ length: 100 }, (_, i) => record(i + 1, '选手' + i)) }
    })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    expect(view.container.querySelector('[data-test=wizard-retry-data]')).not.toBeNull()
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(true)
    await chooseFile(view)
    expect(view.container.querySelector('.scores-preview')).toBeNull()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).toHaveBeenLastCalledWith(false)
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    scoreListGet.mockResolvedValue({ items: [savedScore()], total: 1 })
    view.container.querySelector('[data-test=wizard-retry-data]').click()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(false)
    view.unmount()
  })

  it('does not accept a truncated snapshot as complete', async () => {
    registrationListGet.mockResolvedValue({ total: 2, items: [registration()] })
    scoreListGet.mockResolvedValue({ items: [savedScore()], total: 1 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    view.container.querySelector('[data-test=wizard-use-existing]').click()
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('holds the parent busy while snapshot loading is pending', async () => {
    let finish
    scoreListGet.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ items: [savedScore()], total: 1 }) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    expect(view.busy).toHaveBeenLastCalledWith(true)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(true)
    finish()
    await flushPromises(5)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(false)
    view.unmount()
  })

  it('waits for a real successful save and prevents duplicate pending submissions', async () => {
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    let finish
    scoreBatchImport.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve([savedScore()]) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    await chooseFile(view)
    const submit = view.container.querySelector('.btn-submit')
    submit.click(); submit.click()
    await flushPromises()
    expect(scoreBatchImport).toHaveBeenCalledOnce()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).toHaveBeenLastCalledWith(true)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    finish()
    await flushPromises(5)
    expect(view.complete).toHaveBeenCalledOnce()
    expect(view.busy).toHaveBeenLastCalledWith(false)
    view.unmount()
  })

  it('retains a failed import and releases busy without advancing, then permits retry', async () => {
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    scoreBatchImport.mockRejectedValueOnce({ detail: '服务端校验失败' })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(view.container.textContent).toContain('服务端校验失败')
    expect(view.container.querySelector('.scores-preview')).not.toBeNull()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).toHaveBeenLastCalledWith(false)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(view.complete).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('blocks invalid draft rows and requires clearing the file before reusing saved scores', async () => {
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    scoreListGet.mockResolvedValue({ items: [savedScore()], total: 1 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    await chooseFile(view, [validRows[0], ['张三', '反曲弓', '30m', '排位赛', 0]])
    expect(view.container.querySelector('.btn-submit').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(true)
    expect(view.complete).not.toHaveBeenCalled()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    view.container.querySelector('[data-test=wizard-clear-draft]').click()
    await flushPromises()
    const reuse = view.container.querySelector('[data-test=wizard-use-existing]')
    expect(reuse.disabled).toBe(false)
    reuse.click(); reuse.click()
    await flushPromises()
    expect(view.complete).toHaveBeenCalledOnce()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    view.unmount()
  })

  it('releases parsing busy after a broken workbook without advancing', async () => {
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    view.busy.mockClear()
    await chooseFile(view, validRows, new File([new Uint8Array([0, 1, 2, 3])], '损坏.xlsx'))
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).toHaveBeenCalledWith(true)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    expect(view.container.querySelector('[data-test=wizard-use-existing]').disabled).toBe(true)
    view.unmount()
  })

  it('aborts an active reader and releases parent busy on unmount without completing', async () => {
    const abort = vi.fn(function () { this.onabort?.() })
    vi.stubGlobal('FileReader', class { readAsArrayBuffer() {} abort = abort })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    await chooseFile(view)
    expect(view.busy).toHaveBeenLastCalledWith(true)
    view.unmount()
    await flushPromises()
    expect(abort).toHaveBeenCalledOnce()
    expect(view.busy).toHaveBeenLastCalledWith(false)
    expect(view.complete).not.toHaveBeenCalled()
    expect(scoreBatchImport).not.toHaveBeenCalled()
  })

  it('imports the selected ordinary event then returns to the list without wizard completion', async () => {
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport)
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(scoreBatchImport.mock.calls[0][0].scores[0].event_id).toBe(2)
    expect(scoreListGet).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith('/event-list')
    expect(view.container.querySelector('[data-test=score-manage-panel]')).not.toBeNull()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).not.toHaveBeenCalled()
    view.unmount()
  })


  it('blocks upload during dictionary failure until retry succeeds', async () => {
    const { dictionaryAPI } = await import('@/api')
    dictionaryAPI.getAll.mockRejectedValueOnce(new Error('字典离线'))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    expect(view.container.textContent).toContain('加载字典数据失败，请重试')
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    view.container.querySelector('[data-test=wizard-retry-data]').click()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('releases parsing busy after a file reader error without submitting', async () => {
    vi.stubGlobal('FileReader', class {
      readAsArrayBuffer() { this.onerror() }
      abort() {}
    })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent })
    view.busy.mockClear()
    await chooseFile(view)
    expect(view.container.textContent).toContain('文件读取失败，请重试')
    expect(view.busy).toHaveBeenCalledWith(true)
    expect(view.busy).toHaveBeenLastCalledWith(false)
    expect(view.complete).not.toHaveBeenCalled()
    expect(scoreBatchImport).not.toHaveBeenCalled()
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

  it.each(['1', 1])('binds managed event %s without loading or defaulting to any other event', async managedEventId => {
    bindFixtures()
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId })
    expect(eventDetailGet).toHaveBeenCalledExactlyOnceWith(1)
    expect(eventListGet).not.toHaveBeenCalled()
    expect(view.container.querySelector('#event-select')).toBeNull()
    expect(view.container.querySelector('[data-test=managed-locked-event]').textContent).toContain('2025 冬季赛（已锁定）')
    expect(registrationListGet).toHaveBeenCalledWith({ year: 2025, season: '冬季赛', page: 1, page_size: 100 })
    expect(scoreListGet).toHaveBeenCalledWith({ event_id: 1, page: 1, page_size: 100 })
    expect(view.container.querySelector('[data-test=score-manage-panel]').textContent).toContain('"event_id":1')
    view.container.querySelector('.config-toggle').click()
    await flushPromises()
    expect(view.container.querySelector('.config-table').textContent).toContain('8')
    expect(view.container.querySelector('[data-test=wizard-use-existing]')).toBeNull()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).not.toHaveBeenCalled()
    view.unmount()
  })

  it.each([null, '', [], ['1'], ['1', '2'], '0', '-1', '1.2', '1e2', '01', ' 1 ', 0, -1, 1.2, NaN, Infinity, 9007199254740992])('rejects invalid managed ID %j without falling back to other events', async managedEventId => {
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId })
    expect(view.container.querySelector('[data-test=managed-event-error]').textContent).toContain('赛事编号无效')
    expect(eventDetailGet).not.toHaveBeenCalled()
    expect(eventListGet).not.toHaveBeenCalled()
    expect(registrationListGet).not.toHaveBeenCalled()
    expect(scoreListGet).not.toHaveBeenCalled()
    expect(view.container.querySelector('.btn-upload')).toBeNull()
    expect(view.container.querySelector('#event-select')).toBeNull()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    view.unmount()
  })

  it.each([
    { ...managedDetail(), id: 2 },
    { ...managedDetail(), id: '1' },
    { ...managedDetail(), year: '2025' },
    { ...managedDetail(), season: '未知赛季' },
    { ...managedDetail(), configurations: null },
  ])('refuses mismatched or incomplete bound detail %#', async detail => {
    eventDetailGet.mockResolvedValue(detail)
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: '1' })
    expect(view.container.textContent).toContain('已禁止导入')
    expect(eventListGet).not.toHaveBeenCalled()
    expect(scoreListGet).not.toHaveBeenCalled()
    expect(registrationListGet).not.toHaveBeenCalled()
    expect(view.container.querySelector('.btn-upload')).toBeNull()
    view.unmount()
  })

  it('keeps a failed managed detail visible and retries the same ID only', async () => {
    bindFixtures()
    eventDetailGet.mockRejectedValueOnce({ detail: '指定赛事不存在或已移除' })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: '1' })
    expect(view.container.textContent).toContain('指定赛事不存在或已移除')
    expect(view.container.textContent).not.toContain('当前无赛事记录')
    expect(view.container.querySelector('.btn-upload')).toBeNull()
    expect(eventListGet).not.toHaveBeenCalled()
    view.container.querySelector('[data-test=managed-event-retry]').click()
    await flushPromises(5)
    expect(eventDetailGet.mock.calls).toEqual([[1], [1]])
    expect(view.container.querySelector('[data-test=managed-locked-event]')).not.toBeNull()
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    view.unmount()
  })

  it('does not expose upload until pending managed detail and all validation data finish', async () => {
    bindFixtures()
    let finishDetail
    let finishScores
    eventDetailGet.mockReturnValueOnce(new Promise(resolve => { finishDetail = () => resolve(managedDetail()) }))
    scoreListGet.mockReturnValueOnce(new Promise(resolve => { finishScores = () => resolve({ items: [savedScore()], total: 1 }) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    expect(view.container.querySelector('[data-test=managed-event-loading]')).not.toBeNull()
    expect(view.container.querySelector('.btn-upload')).toBeNull()
    expect(eventListGet).not.toHaveBeenCalled()
    finishDetail()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=score-manage-panel]')).toBeNull()
    finishScores()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    expect(view.container.querySelector('[data-test=score-manage-panel]')).not.toBeNull()
    view.unmount()
  })

  it.each(['registrations', 'scores'])('requires complete managed %s pages and retries without changing event', async kind => {
    bindFixtures()
    const loader = kind === 'registrations' ? registrationListGet : scoreListGet
    const record = kind === 'registrations' ? boundRegistration : savedScore
    loader.mockImplementation(async ({ page }) => {
      if (page === 2) throw new Error('第二页读取失败')
      return { items: Array.from({ length: 100 }, (_, index) => record(index + 1, '其他' + index)), total: 101 }
    })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    expect(view.container.querySelector('[data-test=managed-retry-data]')).not.toBeNull()
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=score-manage-panel]')).toBeNull()
    await chooseFile(view)
    expect(view.container.querySelector('.scores-preview')).toBeNull()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    loader.mockImplementation(async ({ page }) => ({ items: page === 1 ? Array.from({ length: 100 }, (_, index) => record(index + 1, '其他' + index)) : [record(101)], total: 101 }))
    view.container.querySelector('[data-test=managed-retry-data]').click()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    expect(view.container.querySelector('.error-message')).toBeNull()
    expect(eventDetailGet.mock.calls).toEqual([[1], [1]])
    expect(eventListGet).not.toHaveBeenCalled()
    await chooseFile(view)
    expect(view.container.textContent).toContain('合法 1 / 异常 0')
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(scoreBatchImport.mock.calls[0][0].scores[0].event_id).toBe(1)
    expect(routerPush).toHaveBeenCalledWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it.each(['registrations', 'scores'])('blocks foreign-event %s from enabling bound import', async kind => {
    bindFixtures()
    if (kind === 'registrations') registrationListGet.mockResolvedValue({ items: [{ ...boundRegistration(), season: '春季赛' }], total: 1 })
    else scoreListGet.mockResolvedValue({ items: [{ ...savedScore(), event_id: 2 }], total: 1 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    expect(view.container.querySelector('[data-test=managed-retry-data]')).not.toBeNull()
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=score-manage-panel]')).toBeNull()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    view.unmount()
  })

  it('returns to the list from managed back, cancel and complete controls', async () => {
    bindFixtures()
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    for (const selector of ['.btn-back', '.btn-cancel', '[data-test=score-complete]']) view.container.querySelector(selector).click()
    expect(routerPush.mock.calls).toEqual([['/event-list'], ['/event-list'], ['/event-list']])
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps failed bound import drafts and navigates only after a successful retry', async () => {
    bindFixtures()
    scoreBatchImport.mockRejectedValueOnce({ detail: '保存失败，请修正后重试' })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('保存失败，请修正后重试')
    expect(view.container.querySelector('.scores-preview')).not.toBeNull()
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.container.querySelector('.scores-preview')).toBeNull()
    view.unmount()
  })

  it('prevents duplicate imports and premature completion during a bound write', async () => {
    bindFixtures()
    let finish
    scoreBatchImport.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve([savedScore()]) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    await chooseFile(view)
    const submit = view.container.querySelector('.btn-submit')
    submit.click(); submit.click()
    await flushPromises()
    expect(scoreBatchImport).toHaveBeenCalledOnce()
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-test=score-complete]').disabled).toBe(true)
    expect(view.container.querySelector('.btn-back').disabled).toBe(true)
    expect(view.container.querySelector('.btn-cancel').disabled).toBe(true)
    finish()
    await flushPromises(5)
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
    view.unmount()
  })

  it('does not misreport a saved import as an API failure if navigation fails', async () => {
    bindFixtures()
    routerPush.mockRejectedValueOnce(new Error('清单页面加载失败'))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(view.container.textContent).toContain('成绩已保存，但返回赛事清单失败')
    expect(view.container.querySelector('.scores-preview')).toBeNull()
    view.container.querySelector('[data-test=score-complete]').click()
    expect(routerPush).toHaveBeenCalledTimes(2)
    expect(scoreBatchImport).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('keeps managed upload locked after malformed dictionaries until a full retry succeeds', async () => {
    bindFixtures()
    const { dictionaryAPI } = await import('@/api')
    dictionaryAPI.getAll.mockResolvedValueOnce({ data: {} })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    expect(view.container.textContent).toContain('加载字典数据失败，请重试')
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=score-manage-panel]')).toBeNull()
    view.container.querySelector('[data-test=managed-retry-data]').click()
    await flushPromises(5)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(false)
    expect(eventDetailGet.mock.calls).toEqual([[1], [1]])
    expect(eventListGet).not.toHaveBeenCalled()
    view.unmount()
  })

  it('ignores a bound detail response arriving after the page is unmounted', async () => {
    let finishDetail
    eventDetailGet.mockReturnValueOnce(new Promise(resolve => { finishDetail = () => resolve(managedDetail()) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    view.unmount()
    finishDetail()
    await flushPromises(5)
    expect(registrationListGet).not.toHaveBeenCalled()
    expect(scoreListGet).not.toHaveBeenCalled()
    expect(scoreBatchImport).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.complete).not.toHaveBeenCalled()
  })

  it('does not navigate or emit completion when an import finishes after leaving the managed page', async () => {
    bindFixtures()
    let finishSave
    scoreBatchImport.mockImplementationOnce(() => new Promise(resolve => { finishSave = () => resolve([savedScore()]) }))
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { managedEventId: 1 })
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises()
    expect(scoreBatchImport).toHaveBeenCalledOnce()
    view.unmount()
    finishSave()
    await flushPromises(5)
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.complete).not.toHaveBeenCalled()
  })

  it('keeps wizard event precedence and never redirects the wizard to the event list', async () => {
    registrationListGet.mockResolvedValue({ items: [registration()], total: 1 })
    const { default: ScoreImport } = await import('./ScoreImport.vue')
    const view = await mountComponent(ScoreImport, { wizardEvent, managedEventId: null })
    expect(eventDetailGet).not.toHaveBeenCalled()
    expect(eventListGet).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-test=score-complete]')).toBeNull()
    await chooseFile(view)
    view.container.querySelector('.btn-submit').click()
    await flushPromises(5)
    expect(view.complete).toHaveBeenCalledOnce()
    expect(routerPush).not.toHaveBeenCalled()
    view.unmount()
  })
})
