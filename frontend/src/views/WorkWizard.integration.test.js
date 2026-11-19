import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import * as XLSX from 'xlsx'
import WorkWizard from './WorkWizard.vue'

const { replace, server } = vi.hoisted(() => ({
  replace: vi.fn(),
  server: {
    listEvents: vi.fn(), createEvent: vi.fn(), getEvent: vi.fn(),
    listRegistrations: vi.fn(), importRegistrations: vi.fn(),
    createConfig: vi.fn(), updateConfig: vi.fn(),
    listScores: vi.fn(), importScores: vi.fn(), dictionary: vi.fn(),
  },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('@/api', () => ({
  eventAPI: { getList: server.listEvents, createWithConfigs: server.createEvent, getDetail: server.getEvent },
  eventRegistrationAPI: { getList: server.listRegistrations, batchImport: server.importRegistrations },
  eventConfigAPI: { create: server.createConfig, update: server.updateConfig },
  scoreAPI: { getList: server.listScores, batchImport: server.importScores },
  dictionaryAPI: { getAll: server.dictionary },
}))

let app
let host
const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.trim().startsWith(text))
const waitForButton = text => vi.waitFor(() => {
  const el = button(text)
  expect(el).toBeDefined()
  expect(el.disabled).toBe(false)
  return el
})
const clickButton = async text => { const el = await waitForButton(text); el.click() }
const stage = title => vi.waitFor(() => expect(host.querySelector('#wizard-step-title')?.textContent).toContain(title))
const change = (node, value, event = 'input') => {
  node.value = value
  node.dispatchEvent(new Event(event, { bubbles: true }))
}
async function uploadExcel(rows) {
  await waitForButton('选择 Excel 文件')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '导入')
  const file = new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], '用例.xlsx')
  const input = host.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

afterEach(() => { app?.unmount(); host?.remove(); vi.resetAllMocks() })

it('runs all six steps with real forms, Excel files and saved-data reviews', async () => {
  const year = new Date().getFullYear()
  const event = { id: 27, year, season: '秋季赛' }
  let exists = false
  let configs = []
  let registrations = []
  let scores = []
  server.dictionary.mockResolvedValue({ data: {
    bowTypes: [{ code: 'barebow', name: '光弓' }],
    distances: [{ code: '30m', name: '30米' }],
    competitionFormats: [{ code: 'ranking', name: '排位赛' }, { code: 'team', name: '团体赛' }, { code: 'mixed_doubles', name: '混双赛' }],
    competitionGenderGroups: [{ code: 'men', name: '男子组' }, { code: 'mixed', name: '混合组' }],
    competitionGroups: [{ bow_type: 'barebow', distance: '30m', group_code: 'A' }],
  } })
  const details = () => ({ ...event, configurations: configs.map(row => ({ ...row })) })
  server.listEvents.mockImplementation(async () => ({ items: exists ? [details()] : [], total: Number(exists) }))
  server.createEvent.mockImplementation(async () => { exists = true; return event })
  server.getEvent.mockImplementation(async () => details())
  server.listRegistrations.mockImplementation(async () => ({ items: registrations, total: registrations.length }))
  server.listScores.mockImplementation(async () => ({ items: scores, total: scores.length }))
  server.importRegistrations.mockImplementation(async body => {
    registrations = body.registrations.map((row, i) => ({ ...row, id: i + 1 }))
    configs = [{ id: 35, event_id: event.id, gender_group: 'men', bow_type: 'barebow', distance: '30m', team_count: 0, mixed_doubles_team_count: 0, individual_participant_count: 1 }]
    return registrations
  })
  server.updateConfig.mockImplementation(async (id, patch) => {
    configs = configs.map(row => row.id === id ? { ...row, ...patch } : row)
    return configs.find(row => row.id === id)
  })
  server.createConfig.mockImplementation(async row => { const created = { ...row, id: 36 }; configs.push(created); return created })
  server.importScores.mockImplementation(async body => {
    scores = body.scores.map((row, i) => ({ ...row, id: i + 1 }))
    return scores
  })

  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(WorkWizard)
  app.mount(host)
  await stage('创建比赛')
  change(host.querySelector('#season'), event.season, 'change')
  await nextTick()
  await vi.waitFor(() => expect(server.listEvents).toHaveBeenCalledWith(expect.objectContaining({ year, season: event.season })))
  await vi.waitFor(() => {
    const submit = host.querySelector('button[type=submit]')
    expect(submit?.disabled).toBe(false)
  })
  host.querySelector('button[type=submit]').click()
  await stage('导入报名表')
  expect(server.createEvent).toHaveBeenCalledWith({ year, season: event.season, configurations: [] })

  await uploadExcel([['姓名', '俱乐部', '距离', '比赛弓种', '积分弓种', '分组'], ['张弓', '训练营', '30m', '光弓', '光弓', '男子组']])
  await clickButton('确认导入报名')
  await stage('核查报名')
  expect(registrations[0]).toMatchObject({ name: '张弓', year, season: event.season, competition_bow_type: 'barebow' })
  await vi.waitFor(() => expect(host.querySelector('[data-test=coverage-row][data-covered=true]')?.textContent).toContain('光弓'))
  await clickButton('核查完毕，下一步')

  await stage('编辑队伍数量')
  await vi.waitFor(() => expect(host.querySelector('[data-test=team-config-editor] [data-team-field=team_count]')).not.toBeNull())
  change(host.querySelector('[data-test=team-config-editor] [data-team-field=team_count]'), '2')
  await nextTick()
  await vi.waitFor(() => expect(host.querySelector('button[type=submit]')?.disabled).toBe(false))
  host.querySelector('button[type=submit]').click()
  await stage('上传成绩表')
  expect(configs.find(row => row.id === 35)).toMatchObject({ team_count: 2, individual_participant_count: 1 })
  expect(server.updateConfig.mock.calls[0][1]).not.toHaveProperty('individual_participant_count')

  await uploadExcel([['姓名', '弓种', '距离', '赛制', '排名'], ['张弓', '光弓', '30m', '排位赛', 1]])
  await clickButton('确认导入')
  await stage('核查成绩')
  expect(scores[0]).toMatchObject({ name: '张弓', event_id: event.id, format: 'ranking', gender_group: 'men', rank: 1 })
  await vi.waitFor(() => expect(host.querySelector('[data-test=coverage-row][data-covered=true]')?.textContent).toContain('男子组'))
  await clickButton('完成并返回积分页')
  expect(replace).toHaveBeenCalledExactlyOnceWith('/points-display')
})
