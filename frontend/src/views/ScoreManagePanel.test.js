import { afterEach, describe, expect, it } from 'vitest'
import { createApp, nextTick, reactive } from 'vue'

const flushPromises = async (times = 3) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

const mountComponent = async (component, props) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component, props)
  app.mount(container)
  await flushPromises(3)
  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('ScoreManagePanel', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('locks mixed doubles gender group to mixed in the editor', async () => {
    const scores = reactive([
      {
        id: 11,
        event_id: 2,
        name: '张三/李四',
        bow_type: 'recurve',
        distance: '30m',
        format: 'mixed_doubles',
        gender_group: 'women',
        rank: 1,
      },
    ])

    const { default: ScoreManagePanel } = await import('./ScoreManagePanel.vue')
    const view = await mountComponent(ScoreManagePanel, {
      scores,
      loading: false,
      bowTypes: [{ code: 'recurve', name: '反曲弓' }],
      distances: [{ code: '30m', name: '30米' }],
      competitionFormats: [{ code: 'mixed_doubles', name: '混双赛' }],
      competitionGenderGroups: [
        { code: 'men', name: '男子组' },
        { code: 'women', name: '女子组' },
        { code: 'mixed', name: '混合组' },
      ],
    })

    await flushPromises(3)

    const selects = view.container.querySelectorAll('select.cell-input')
    const genderGroupSelect = selects[3]
    const optionLabels = Array.from(genderGroupSelect.querySelectorAll('option')).map(option => option.textContent)

    expect(scores[0].gender_group).toBe('mixed')
    expect(genderGroupSelect).not.toBeUndefined()
    expect(genderGroupSelect.disabled).toBe(true)
    expect(genderGroupSelect.value).toBe('mixed')
    expect(optionLabels).toEqual(['男子组', '女子组', '混合组'])

    view.unmount()
  })

  it('normalizes gender group when format changes to mixed doubles', async () => {
    const scores = reactive([
      {
        id: 12,
        event_id: 2,
        name: '王五',
        bow_type: 'recurve',
        distance: '30m',
        format: 'ranking',
        gender_group: 'women',
        rank: 2,
      },
    ])

    const { default: ScoreManagePanel } = await import('./ScoreManagePanel.vue')
    const view = await mountComponent(ScoreManagePanel, {
      scores,
      loading: false,
      bowTypes: [{ code: 'recurve', name: '反曲弓' }],
      distances: [{ code: '30m', name: '30米' }],
      competitionFormats: [
        { code: 'ranking', name: '排位赛' },
        { code: 'mixed_doubles', name: '混双赛' },
      ],
      competitionGenderGroups: [
        { code: 'men', name: '男子组' },
        { code: 'women', name: '女子组' },
        { code: 'mixed', name: '混合组' },
      ],
    })

    const formatSelect = view.container.querySelectorAll('select.cell-input')[2]
    formatSelect.value = 'mixed_doubles'
    formatSelect.dispatchEvent(new Event('change'))
    await flushPromises(3)

    const genderGroupSelect = view.container.querySelectorAll('select.cell-input')[3]

    expect(scores[0].format).toBe('mixed_doubles')
    expect(scores[0].gender_group).toBe('mixed')
    expect(genderGroupSelect.disabled).toBe(true)
    expect(genderGroupSelect.value).toBe('mixed')

    view.unmount()
  })
})