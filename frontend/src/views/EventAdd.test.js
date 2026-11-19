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
          { code: 'barebow', name: '光弓' },
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

const mountComponent = async (component, props = {}) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component, props)
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

  it('keeps rule management on the event list and returns there from the configuration header', async () => {
    const { default: EventAdd } = await import('./EventAdd.vue')
    const view = await mountComponent(EventAdd)
    expect(view.container.querySelector('[data-test=scoring-rules-link]')).toBeNull()
    expect(view.container.querySelector('.form-container > .section').textContent).toContain('基本信息')
    view.container.querySelector('.btn-back').click()
    expect(routerPush).toHaveBeenCalledWith('/event-list')
    view.unmount()
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

const excelData = { rows: [] }
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['报名'], Sheets: { 报名: {} } })),
  utils: { sheet_to_json: vi.fn(() => excelData.rows) },
}))

const wizardEvent = { id: 44, year: 2026, season: '春季赛' }
const registrationRow = id => ({ id, year: 2026, season: '春季赛', name: '选手' + id, club: '甲俱乐部', distance: '18m',
  competition_bow_type: 'sightless', points_bow_type: 'barebow', competition_gender_group: 'mixed' })
const fillSeason = async (view, season = '春季赛') => {
  const year = view.container.querySelector('#year')
  year.value = '2026'
  year.dispatchEvent(new Event('input', { bubbles: true }))
  const select = view.container.querySelector('#season')
  select.value = season
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises(5)
}
const submitEvent = async view => {
  view.container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises(5)
}
const uploadRegistration = async view => {
  const input = view.container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['workbook'], '报名.xlsx')] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises(5)
}

describe('EventAdd optional work wizard modes', () => {
  let api
  let views
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api = await import('@/api')
    views = []
    eventListGet.mockResolvedValue({ items: [], total: 0 })
    eventRegistrationListGet.mockResolvedValue({ items: [], total: 0 })
    api.eventAPI.getDetail.mockResolvedValue({ ...wizardEvent, configurations: [] })
    api.eventAPI.createWithConfigs.mockResolvedValue({ ...wizardEvent, configurations: [] })
    api.eventRegistrationAPI.batchImport.mockResolvedValue([registrationRow(1)])
    api.eventConfigAPI.create.mockResolvedValue({ id: 100 })
    api.eventConfigAPI.update.mockResolvedValue({ id: 11 })
    api.eventConfigAPI.delete.mockResolvedValue({})
    excelData.rows = [
      ['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'],
      ['新选手', '甲俱乐部', '18m', '无瞄弓', '光弓', '混合组'],
    ]
    vi.stubGlobal('FileReader', class {
      readAsArrayBuffer() { queueMicrotask(() => this.onload({ target: { result: new ArrayBuffer(0) } })) }
    })
  })
  afterEach(() => {
    views.forEach(view => view.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const mountWizard = async (mode, callbacks = {}, event = wizardEvent) => {
    const { default: EventAdd } = await import('./EventAdd.vue')
    const view = await mountComponent(EventAdd, { wizardMode: mode, wizardEvent: event, ...callbacks })
    views.push(view)
    return view
  }

  it('step1 creates an empty event and emits its exact identity, without unrelated forms or navigation', async () => {
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountWizard('create', { onComplete: complete, onBusyChange: busy }, null)
    expect(view.container.querySelector('.page-header')).toBeNull()
    expect(view.container.querySelector('[data-test=scoring-rules-link]')).toBeNull()
    expect(view.container.querySelector('[data-test=registration-section]')).toBeNull()
    expect(view.container.querySelector('[data-test=configuration-section]')).toBeNull()
    expect(api.dictionaryAPI.getAll).not.toHaveBeenCalled()
    await fillSeason(view)
    await submitEvent(view)
    expect(api.eventAPI.createWithConfigs).toHaveBeenCalledExactlyOnceWith({ year: 2026, season: '春季赛', configurations: [] })
    expect(complete).toHaveBeenCalledExactlyOnceWith(wizardEvent)
    expect(busy.mock.calls.some(([value]) => value)).toBe(true)
    expect(busy.mock.calls.at(-1)).toEqual([false])
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('step1 pre-fills a prior wizard event and only explicitly continues when the same season already exists', async () => {
    eventListGet.mockResolvedValue({ items: [{ ...wizardEvent, configurations: [{ id: 11 }] }], total: 1 })
    const complete = vi.fn()
    const view = await mountWizard('create', { onComplete: complete })
    expect(view.container.querySelector('#year').value).toBe('2026')
    expect(view.container.querySelector('#season').value).toBe('春季赛')
    expect(complete).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('不修改已有数据')
    await submitEvent(view)
    expect(complete).toHaveBeenCalledExactlyOnceWith(wizardEvent)
    expect(api.eventAPI.createWithConfigs).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.update).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.delete).not.toHaveBeenCalled()
  })

  it('step1 blocks query failures and unsuccessful creation and releases busy for a retry', async () => {
    eventListGet.mockRejectedValueOnce(new Error('列表失败'))
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountWizard('create', { onComplete: complete, onBusyChange: busy })
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    expect(complete).not.toHaveBeenCalled()
    view.container.querySelector('.btn-retry-inline').click()
    await flushPromises(5)
    api.eventAPI.createWithConfigs.mockRejectedValueOnce(new Error('保存失败'))
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(busy.mock.calls.at(-1)).toEqual([false])
    expect(view.container.textContent).toContain('保存失败')
    await submitEvent(view)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('step1 rejects a malformed success response rather than advancing without an event ID', async () => {
    api.eventAPI.createWithConfigs.mockResolvedValue({ message: 'ok' })
    const complete = vi.fn()
    const view = await mountWizard('create', { onComplete: complete })
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('返回信息不完整')
  })

  it('step2 locks event identity, loads every registration page, and permits explicit existing-data continuation only', async () => {
    const all = Array.from({ length: 1001 }, (_, index) => registrationRow(index + 1))
    eventRegistrationListGet.mockImplementation(async ({ page }) => ({ items: page === 1 ? all.slice(0, 1000) : all.slice(1000), total: 1001 }))
    const complete = vi.fn()
    const view = await mountWizard('registrations', { onComplete: complete })
    expect(view.container.querySelector('#year').disabled).toBe(true)
    expect(view.container.querySelector('#season').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=configuration-section]')).toBeNull()
    expect(view.container.querySelector('[data-test=registration-manage]')).toBeNull()
    expect(eventRegistrationListGet).toHaveBeenCalledWith({ year: 2026, season: '春季赛', page: 2, page_size: 1000 })
    const button = view.container.querySelector('[data-test=use-existing-registrations]')
    expect(button.textContent).toContain('1001条')
    expect(button.disabled).toBe(false)
    expect(complete).not.toHaveBeenCalled()
    button.click()
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(api.eventRegistrationAPI.batchImport).not.toHaveBeenCalled()
  })

  it('step2 does not treat partial pagination as a loaded empty list or allow continuing', async () => {
    eventRegistrationListGet.mockResolvedValue({ items: [registrationRow(1)], total: 2 })
    const complete = vi.fn()
    const view = await mountWizard('registrations', { onComplete: complete })
    expect(view.container.textContent).toContain('历史报名加载失败')
    expect(view.container.querySelector('[data-test=use-existing-registrations]').disabled).toBe(true)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(api.eventRegistrationAPI.batchImport).not.toHaveBeenCalled()
  })

  it('step2 reuses Excel preview and only advances after actual registration save success', async () => {
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountWizard('registrations', { onComplete: complete, onBusyChange: busy })
    await uploadRegistration(view)
    expect(view.container.textContent).toContain('正常记录')
    let finish
    api.eventRegistrationAPI.batchImport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const button = Array.from(view.container.querySelectorAll('.import-actions .btn-submit')).find(button => button.textContent.includes('确认导入'))
    expect(button.disabled).toBe(false)
    button.click()
    await flushPromises()
    expect(complete).not.toHaveBeenCalled()
    expect(busy.mock.calls.at(-1)).toEqual([true])
    finish([registrationRow(9)])
    await flushPromises(5)
    expect(api.eventRegistrationAPI.batchImport.mock.calls[0][0].registrations[0]).toMatchObject({ year: 2026, season: '春季赛', name: '新选手', competition_bow_type: 'sightless', points_bow_type: 'barebow' })
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(busy.mock.calls.at(-1)).toEqual([false])
  })

  it('step2 blocks invalid preview rows and a failed import never completes', async () => {
    const complete = vi.fn()
    const view = await mountWizard('registrations', { onComplete: complete })
    excelData.rows[1][2] = '999m'
    await uploadRegistration(view)
    expect(view.container.textContent).toContain('异常记录')
    let button = Array.from(view.container.querySelectorAll('.import-actions .btn-submit')).find(button => button.textContent.includes('确认导入'))
    expect(button.disabled).toBe(true)
    expect(complete).not.toHaveBeenCalled()
    excelData.rows[1][2] = '18m'
    await uploadRegistration(view)
    api.eventRegistrationAPI.batchImport.mockRejectedValueOnce({ detail: '导入失败' })
    button = Array.from(view.container.querySelectorAll('.import-actions .btn-submit')).find(button => button.textContent.includes('确认导入'))
    button.click()
    await flushPromises(5)
    expect(complete).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('导入失败')
    expect(button.disabled).toBe(false)
  })

  it('step4 edits only teams/mixed doubles, preserves individual/unknown configuration rows, and never deletes', async () => {
    api.eventAPI.getDetail.mockResolvedValue({ ...wizardEvent, configurations: [
      { id: 11, gender_group: 'men', bow_type: 'recurve', distance: '10m', individual_participant_count: 9, team_count: 0, mixed_doubles_team_count: 0 },
      { id: 99, gender_group: 'men', bow_type: 'compound', distance: '70m', individual_participant_count: 17, team_count: 4, mixed_doubles_team_count: 0 },
    ] })
    const complete = vi.fn()
    const view = await mountWizard('teams', { onComplete: complete })
    expect(view.container.querySelector('[data-test=registration-section]')).toBeNull()
    expect(view.container.querySelector('.config-table')).toBeNull()
    const card = view.container.querySelector('[data-test=team-config-editor] fieldset')
    expect(card.querySelector('legend').textContent).toContain('10')
    expect(card.querySelector('[aria-label$="团体 · 男子组"]')).not.toBeNull()
    expect(card.querySelector('[aria-label$="混双 · 混合组"]')).not.toBeNull()
    const input = view.container.querySelector('.team-count-input')
    input.value = '3'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await submitEvent(view)
    expect(api.eventConfigAPI.update).toHaveBeenCalledWith(11, { team_count: 3, mixed_doubles_team_count: 0 })
    expect(api.eventConfigAPI.update.mock.calls.every(([, data]) => !('individual_participant_count' in data))).toBe(true)
    expect(api.eventConfigAPI.update.mock.calls.some(([id]) => id === 99)).toBe(false)
    expect(api.eventConfigAPI.delete).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledExactlyOnceWith()
  })

  it('step4 allows no team projects and validates malformed counts before writing', async () => {
    const complete = vi.fn()
    const view = await mountWizard('teams', { onComplete: complete })
    const input = view.container.querySelector('.team-count-input')
    input.value = '1.5'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.create).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('非负整数')
    input.value = '0'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await submitEvent(view)
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(api.eventConfigAPI.delete).not.toHaveBeenCalled()
  })

  it('step4 waits for every write to settle, does not advance on partial failure, and rereads detail when retrying', async () => {
    let records = [{ id: 11, gender_group: 'men', bow_type: 'recurve', distance: '10m', individual_participant_count: 9, team_count: 0, mixed_doubles_team_count: 0 }]
    api.eventAPI.getDetail.mockImplementation(async () => ({ ...wizardEvent, configurations: records }))
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountWizard('teams', { onComplete: complete, onBusyChange: busy })
    const inputs = view.container.querySelectorAll('.team-count-input')
    inputs[0].value = '3'
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[1].value = '2'
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    let finish
    api.eventConfigAPI.update.mockRejectedValueOnce(new Error('其中一项保存失败'))
    api.eventConfigAPI.create.mockImplementationOnce(data => new Promise(resolve => { finish = () => {
      records = [...records, { ...data, id: 12 }]
      resolve({ id: 12 })
    } }))
    view.container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    await flushPromises()
    expect(busy.mock.calls.at(-1)).toEqual([true])
    expect(complete).not.toHaveBeenCalled()
    finish()
    await flushPromises(5)
    expect(busy.mock.calls.at(-1)).toEqual([false])
    expect(complete).not.toHaveBeenCalled()
    await submitEvent(view)
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(api.eventConfigAPI.create).toHaveBeenCalledTimes(1)
    expect(api.eventConfigAPI.update).toHaveBeenCalledWith(12, { team_count: 2, mixed_doubles_team_count: 0 })
    expect(api.eventAPI.getDetail).toHaveBeenCalledTimes(3)
  })

  it('step4 saves mixed doubles in its explicit mixed group while omitting individual values', async () => {
    const complete = vi.fn()
    const view = await mountWizard('teams', { onComplete: complete })
    const mixedInput = view.container.querySelector('[data-team-field=mixed_doubles_team_count]')
    expect(mixedInput).not.toBeNull()
    mixedInput.value = '4'
    mixedInput.dispatchEvent(new Event('input', { bubbles: true }))
    await submitEvent(view)
    expect(api.eventConfigAPI.create).toHaveBeenCalledWith({ event_id: 44, gender_group: 'mixed', bow_type: 'recurve', distance: '10m', individual_participant_count: 0, team_count: 0, mixed_doubles_team_count: 4 })
    expect(complete).toHaveBeenCalledExactlyOnceWith()
  })

  it('step2 permits returning to existing registrations only after clearing a draft explicitly', async () => {
    eventRegistrationListGet.mockResolvedValue({ items: [registrationRow(1)], total: 1 })
    const complete = vi.fn()
    const view = await mountWizard('registrations', { onComplete: complete })
    await uploadRegistration(view)
    expect(view.container.querySelector('[data-test=use-existing-registrations]').disabled).toBe(true)
    view.container.querySelector('[data-test=clear-registration-draft]').click()
    await flushPromises()
    expect(view.container.querySelector('[data-test=use-existing-registrations]').disabled).toBe(false)
    view.container.querySelector('[data-test=use-existing-registrations]').click()
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(api.eventRegistrationAPI.batchImport).not.toHaveBeenCalled()
  })

  it('releases busy on unmount but does not complete a later successful request from the old step', async () => {
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountWizard('create', { onComplete: complete, onBusyChange: busy })
    let finish
    api.eventAPI.createWithConfigs.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    view.container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(busy.mock.calls.at(-1)).toEqual([true])
    view.unmount()
    views.splice(views.indexOf(view), 1)
    expect(busy.mock.calls.at(-1)).toEqual([false])
    const count = busy.mock.calls.length
    finish(wizardEvent)
    await flushPromises(5)
    expect(complete).not.toHaveBeenCalled()
    expect(busy.mock.calls.length).toBe(count)
  })

  it('blocks registrations/teams when the required event object is missing without querying unrelated events', async () => {
    const complete = vi.fn()
    const view = await mountWizard('teams', { onComplete: complete }, null)
    expect(view.container.textContent).toContain('向导赛事信息无效')
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(api.eventAPI.getDetail).not.toHaveBeenCalled()
    expect(eventListGet).not.toHaveBeenCalled()
  })

  it.each(['registrations', 'teams'])('%s refuses invalid or mismatched locked event identity', async mode => {
    api.eventAPI.getDetail.mockResolvedValue({ ...wizardEvent, id: 999, configurations: [] })
    const complete = vi.fn()
    const view = await mountWizard(mode, { onComplete: complete })
    expect(view.container.textContent).toContain('历史配置加载失败')
    await submitEvent(view)
    expect(complete).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.create).not.toHaveBeenCalled()
    expect(api.eventRegistrationAPI.batchImport).not.toHaveBeenCalled()
  })
})

describe('EventAdd managed event binding and ordinary creation', () => {
  let api
  let views
  const identity = { id: 44, year: 2026, season: '春季赛' }
  const configuration = { id: 11, event_id: 44, gender_group: 'mixed', bow_type: 'sightless', distance: '18m', individual_participant_count: 0, team_count: 2, mixed_doubles_team_count: 1 }
  const detail = (overrides = {}) => ({ ...identity, configurations: [{ ...configuration }], ...overrides })
  const mountPage = async (props = {}) => {
    const { default: EventAdd } = await import('./EventAdd.vue')
    const complete = vi.fn()
    const busy = vi.fn()
    const view = await mountComponent(EventAdd, { ...props, onComplete: complete, onBusyChange: busy })
    views.push(view)
    return { ...view, complete, busy }
  }
  const assertNoWrites = () => {
    for (const operation of [api.eventAPI.createWithConfigs, api.eventConfigAPI.create, api.eventConfigAPI.update, api.eventConfigAPI.delete, api.eventRegistrationAPI.batchImport]) expect(operation).not.toHaveBeenCalled()
  }
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api = await import('@/api')
    views = []
    routerPush.mockReset()
    eventListGet.mockReset().mockResolvedValue({ items: [], total: 0 })
    eventRegistrationListGet.mockReset().mockResolvedValue({ items: [], total: 0 })
    api.eventAPI.getDetail.mockReset().mockResolvedValue(detail())
    api.eventAPI.createWithConfigs.mockReset().mockResolvedValue(identity)
    api.eventConfigAPI.create.mockReset().mockResolvedValue({ id: 100 })
    api.eventConfigAPI.update.mockReset().mockResolvedValue(configuration)
    api.eventConfigAPI.delete.mockReset().mockResolvedValue({})
    api.eventRegistrationAPI.batchImport.mockReset().mockResolvedValue([registrationRow(1)])
    excelData.rows = [['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'], ['新选手', '甲俱乐部', '18m', '无瞄弓', '光弓', '混合组']]
    vi.stubGlobal('FileReader', class { readAsArrayBuffer() { queueMicrotask(() => this.onload({ target: { result: new ArrayBuffer(0) } })) } })
  })
  afterEach(() => { views.forEach(view => view.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it.each([44, '44'])('loads only event %s, locks its identity and updates that event before returning to the list', async managedEventId => {
    const view = await mountPage({ managedEventId })
    expect(eventListGet).not.toHaveBeenCalled()
    expect(api.eventAPI.getDetail).toHaveBeenCalledExactlyOnceWith(44)
    expect(view.container.querySelector('#year').value).toBe('2026')
    expect(view.container.querySelector('#year').disabled).toBe(true)
    expect(view.container.querySelector('#season').value).toBe('春季赛')
    expect(view.container.querySelector('#season').disabled).toBe(true)
    expect(eventRegistrationListGet).toHaveBeenCalledExactlyOnceWith({ page: 1, page_size: 1000, year: 2026, season: '春季赛' })
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
    await submitEvent(view)
    expect(api.eventConfigAPI.update).toHaveBeenCalledExactlyOnceWith(11, { individual_participant_count: 0, team_count: 2, mixed_doubles_team_count: 1 })
    expect(api.eventAPI.createWithConfigs).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.delete).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.busy).not.toHaveBeenCalled()
  })

  it.each([null, '', '0', '-1', '1.5', '+44', ' 44 ', '44x', '044', '1e2', ['44'], ['44', '45'], 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid managed ID %s without falling back to creation or another event', async managedEventId => {
    const view = await mountPage({ managedEventId })
    expect(view.container.querySelector('[data-test=managed-event-error]').textContent).toContain('正整数')
    expect(view.container.querySelector('#year').disabled).toBe(true)
    expect(view.container.querySelector('#season').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(api.eventAPI.getDetail).not.toHaveBeenCalled()
    expect(eventListGet).not.toHaveBeenCalled()
    await submitEvent(view)
    await uploadRegistration(view)
    assertNoWrites()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it.each([
    { id: 45 }, { id: '44' }, { year: '2026' }, { year: 0 }, { season: '其他赛事' }, { configurations: undefined },
    { configurations: [{ ...configuration, event_id: 45 }] },
  ])('rejects malformed or mismatched detail %j without writes or fallback', async overrides => {
    api.eventAPI.getDetail.mockResolvedValue(detail(overrides))
    const view = await mountPage({ managedEventId: '44' })
    expect(view.container.querySelector('[data-test=managed-event-error]')).not.toBeNull()
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    expect(eventRegistrationListGet).not.toHaveBeenCalled()
    expect(eventListGet).not.toHaveBeenCalled()
    await submitEvent(view)
    assertNoWrites()
  })

  it('keeps a failed bound load locked and retries exactly that identity', async () => {
    api.eventAPI.getDetail.mockRejectedValueOnce({ detail: '赛事不存在或无法读取' })
    const view = await mountPage({ managedEventId: 44 })
    expect(view.container.textContent).toContain('赛事不存在或无法读取')
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    await submitEvent(view)
    assertNoWrites()
    view.container.querySelector('[data-test=retry-managed-event]').click()
    await flushPromises(5)
    expect(api.eventAPI.getDetail.mock.calls).toEqual([[44], [44]])
    expect(view.container.querySelector('[data-test=managed-event-error]')).toBeNull()
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
    expect(eventListGet).not.toHaveBeenCalled()
  })

  it('does not enable writes before identity and all registrations have finished loading', async () => {
    let finish
    eventRegistrationListGet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const view = await mountPage({ managedEventId: 44 })
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    expect(view.container.querySelector('.btn-upload').disabled).toBe(true)
    expect(view.container.querySelector('[data-test=registration-manage]')).toBeNull()
    await submitEvent(view)
    assertNoWrites()
    finish({ items: [], total: 0 })
    await flushPromises(5)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
  })

  it('blocks partial or wrong-season registration snapshots until a complete reload succeeds', async () => {
    eventRegistrationListGet.mockResolvedValueOnce({ total: 2, items: [registrationRow(1)] })
    const view = await mountPage({ managedEventId: 44 })
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    await submitEvent(view)
    assertNoWrites()
    eventRegistrationListGet.mockResolvedValueOnce({ total: 1, items: [{ ...registrationRow(1), season: '夏季赛' }] })
    Array.from(view.container.querySelectorAll('button')).find(button => button.textContent.trim() === '重试加载报名').click()
    await flushPromises(5)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    view.container.querySelector('[data-test=retry-managed-event]').click()
    await flushPromises(5)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
  })

  it('loads all bound registration pages and derives counts from the complete snapshot', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => registrationRow(index + 1))
    eventRegistrationListGet.mockImplementation(async ({ page }) => ({ total: rows.length, items: page === 1 ? rows.slice(0, 1000) : rows.slice(1000) }))
    const view = await mountPage({ managedEventId: '44' })
    expect(eventRegistrationListGet).toHaveBeenCalledWith({ page: 2, page_size: 1000, year: 2026, season: '春季赛' })
    expect(view.container.textContent).toContain('报名数: 1001')
    expect(Array.from(view.container.querySelectorAll('.readonly-cell')).some(node => node.textContent.trim() === '1001')).toBe(true)
  })

  it('ignores DOM attempts to change locked year and season and keeps registration import as an intermediate operation', async () => {
    const view = await mountPage({ managedEventId: 44 })
    await fillSeason(view, '夏季赛')
    expect(view.container.querySelector('#season').disabled).toBe(true)
    expect(eventListGet).not.toHaveBeenCalled()
    await uploadRegistration(view)
    const submit = [...view.container.querySelectorAll('.import-actions .btn-submit')].find(button => button.textContent.includes('确认导入报名'))
    expect(submit.disabled).toBe(false)
    submit.click()
    await flushPromises(5)
    expect(api.eventRegistrationAPI.batchImport.mock.calls[0][0].registrations[0]).toMatchObject({ year: 2026, season: '春季赛' })
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.complete).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
  })

  it('rereads bound detail before writing and rejects a changed identity or foreign configuration', async () => {
    const view = await mountPage({ managedEventId: 44 })
    api.eventAPI.getDetail.mockResolvedValueOnce(detail({ id: 45 }))
    await submitEvent(view)
    assertNoWrites()
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    expect(view.container.textContent).toContain('身份与指定赛事不一致')
  })

  it('retains unlisted historical configuration rows instead of deleting them silently', async () => {
    api.eventAPI.getDetail.mockResolvedValue(detail({ configurations: [{ ...configuration }, { ...configuration, id: 12, bow_type: 'compound', distance: '70m' }] }))
    const view = await mountPage({ managedEventId: 44 })
    await submitEvent(view)
    expect(api.eventConfigAPI.update).toHaveBeenCalledExactlyOnceWith(11, expect.any(Object))
    expect(api.eventConfigAPI.delete).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
  })

  it('stays on the page after a failed bound save and retries only after reloading', async () => {
    api.eventConfigAPI.update.mockRejectedValueOnce({ detail: '配置更新失败' })
    const view = await mountPage({ managedEventId: 44 })
    await submitEvent(view)
    expect(view.container.textContent).toContain('配置更新失败')
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    view.container.querySelector('[data-test=retry-managed-event]').click()
    await flushPromises(5)
    await submitEvent(view)
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
  })

  it('returns to the event list from both cancel and the header without writes', async () => {
    const view = await mountPage({ managedEventId: 44 })
    view.container.querySelector('.form-actions .btn-cancel').click()
    await flushPromises()
    view.container.querySelector('.btn-back').click()
    await flushPromises()
    expect(routerPush.mock.calls).toEqual([['/event-list'], ['/event-list']])
    assertNoWrites()
  })

  it('creates an empty ordinary event and returns to the list after actual success', async () => {
    const view = await mountPage()
    await fillSeason(view)
    await submitEvent(view)
    expect(api.eventAPI.createWithConfigs).toHaveBeenCalledExactlyOnceWith({ year: 2026, season: '春季赛', configurations: [] })
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
    expect(view.complete).not.toHaveBeenCalled()
  })

  it('keeps duplicate-season updates explicit and does not use the create API', async () => {
    eventListGet.mockResolvedValue({ total: 1, items: [detail()] })
    const view = await mountPage()
    await fillSeason(view)
    expect(view.container.textContent).toContain('保存后将更新该赛事配置')
    await submitEvent(view)
    expect(api.eventAPI.createWithConfigs).not.toHaveBeenCalled()
    expect(api.eventConfigAPI.update).toHaveBeenCalledExactlyOnceWith(11, expect.any(Object))
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
  })

  it('never treats failed duplicate-season lookup as permission to create or overwrite', async () => {
    eventListGet.mockRejectedValue(new Error('查询失败'))
    const view = await mountPage()
    await fillSeason(view)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(true)
    await submitEvent(view)
    assertNoWrites()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('does not clear a previously nonempty event with an all-zero form', async () => {
    const view = await mountPage({ managedEventId: 44 })
    for (const input of view.container.querySelectorAll('.table-input')) { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })) }
    await flushPromises()
    await submitEvent(view)
    expect(view.container.textContent).toContain('不能用空配置覆盖已有赛事')
    assertNoWrites()
  })

  it('keeps failed or malformed creation on the page and prevents repeated pending saves', async () => {
    let finish
    api.eventAPI.createWithConfigs.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const view = await mountPage()
    await fillSeason(view)
    view.container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
    await submitEvent(view)
    expect(api.eventAPI.createWithConfigs).toHaveBeenCalledOnce()
    expect(routerPush).not.toHaveBeenCalled()
    finish({ message: 'missing identity' })
    await flushPromises(5)
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('返回信息不完整')
    api.eventAPI.createWithConfigs.mockRejectedValueOnce({ detail: '创建失败' })
    await submitEvent(view)
    expect(routerPush).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain('创建失败')
  })

  it('ignores managed routing props when embedded by a wizard and preserves its complete event contract', async () => {
    const view = await mountPage({ wizardMode: 'create', managedEventId: ['bad'] })
    await fillSeason(view)
    await submitEvent(view)
    expect(view.complete).toHaveBeenCalledExactlyOnceWith(identity)
    expect(routerPush).not.toHaveBeenCalled()
  })
})

describe('EventAdd post-save navigation and historical event identity', () => {
  const views = []
  let api
  const identity = { id: 88, year: 1999, season: '冬季赛' }
  const detail = { ...identity, configurations: [] }
  beforeEach(async () => {
    vi.clearAllMocks()
    routerPush.mockReset()
    api = await import('@/api')
    eventListGet.mockReset().mockResolvedValue({ total: 0, items: [] })
    eventRegistrationListGet.mockReset().mockResolvedValue({ total: 0, items: [] })
    api.eventAPI.getDetail.mockReset().mockResolvedValue(detail)
    api.eventAPI.createWithConfigs.mockReset().mockResolvedValue({ id: 44, year: 2026, season: '春季赛' })
  })
  afterEach(() => { views.splice(0).forEach(view => view.unmount()) })
  it('allows a directly bound old event outside the create-year input range', async () => {
    const { default: EventAdd } = await import('./EventAdd.vue')
    const view = await mountComponent(EventAdd, { managedEventId: '88' })
    views.push(view)
    const year = view.container.querySelector('#year')
    expect(year.value).toBe('1999')
    expect(year.disabled).toBe(true)
    expect(year.hasAttribute('min')).toBe(false)
    expect(year.hasAttribute('max')).toBe(false)
    expect(view.container.querySelector('[data-test=event-submit]').disabled).toBe(false)
    await submitEvent(view)
    expect(api.eventAPI.createWithConfigs).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledExactlyOnceWith('/event-list')
  })
  it.each(['create', 'managed'])('does not mistake %s navigation failure for a write failure or repeat a successful write', async mode => {
    routerPush.mockRejectedValueOnce(new Error('路由跳转失败'))
    const { default: EventAdd } = await import('./EventAdd.vue')
    const view = await mountComponent(EventAdd, mode === 'managed' ? { managedEventId: '88' } : {})
    views.push(view)
    if (mode === 'create') await fillSeason(view)
    await submitEvent(view)
    expect(view.container.querySelector('[data-test=saved-event-status]')).not.toBeNull()
    expect(view.container.textContent).toContain('已保存，但返回赛事清单失败')
    expect(view.container.querySelector('[data-test=managed-event-error]')).toBeNull()
    const submit = view.container.querySelector('[data-test=event-submit]')
    expect(submit.textContent.trim()).toBe('完成')
    expect(submit.disabled).toBe(false)
    const detailCalls = api.eventAPI.getDetail.mock.calls.length
    const createCalls = api.eventAPI.createWithConfigs.mock.calls.length
    submit.click()
    await flushPromises(5)
    expect(routerPush).toHaveBeenCalledTimes(2)
    expect(api.eventAPI.getDetail).toHaveBeenCalledTimes(detailCalls)
    expect(api.eventAPI.createWithConfigs).toHaveBeenCalledTimes(createCalls)
  })
})
