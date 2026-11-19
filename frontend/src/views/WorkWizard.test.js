import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import WorkWizard from './WorkWizard.vue'

const { replace, creates } = vi.hoisted(() => ({ replace: vi.fn(), creates: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('./EventAdd.vue', async () => {
  const { h } = await import('vue')
  return { default: {
    props: ['wizardMode', 'wizardEvent'],
    emits: ['complete', 'busy-change'],
    setup(props, { emit }) {
      creates(props.wizardMode, props.wizardEvent)
      return () => h('div', [
        h('button', { 'data-test': 'busy', onClick: () => emit('busy-change', true) }, '处理中'),
        h('button', { 'data-test': 'release', onClick: () => emit('busy-change', false) }, '释放'),
        h('button', { 'data-test': 'save', onClick: () => emit('complete', props.wizardMode === 'create'
          ? { id: 27, year: 2026, season: '秋季赛' } : undefined) }, '写入成功'),
      ])
    },
  } }
})
vi.mock('./ScoreImport.vue', async () => {
  const { h } = await import('vue')
  return { default: {
    props: ['wizardEvent'],
    emits: ['complete'],
    setup(props, { emit }) {
      return () => h('button', { 'data-test': 'scores', onClick: () => emit('complete') }, '上传完成：' + props.wizardEvent.id)
    },
  } }
})
vi.mock('@/components/WizardCoverage.vue', async () => {
  const { h } = await import('vue')
  return { default: {
    props: ['event', 'kind'],
    emits: ['ready'],
    setup(props, { emit }) {
      return () => h('button', { 'data-test': 'loaded', onClick: () => emit('ready', true) }, props.kind + ':' + props.event.id)
    },
  } }
})

let host
let app
const byText = text => [...host.querySelectorAll('button')].find(button => button.textContent.trim() === text)
const click = async element => { element.click(); await nextTick() }
const clickTest = key => click(host.querySelector('[data-test=' + key + ']'))
const step = () => host.querySelector('[aria-current=step]').textContent
beforeEach(() => {
  replace.mockReset()
  creates.mockReset()
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(WorkWizard)
  app.mount(host)
})
afterEach(() => { app.unmount(); host.remove() })

describe('work wizard navigation', () => {
  it('progresses only on successful writes or loaded review, always scoped to the selected event', async () => {
    expect(step()).toContain('创建比赛')
    expect(host.querySelectorAll('.wizard-steps li')).toHaveLength(6)
    await clickTest('save')
    expect(step()).toContain('导入报名表')
    expect(host.textContent).toContain('2026年 秋季赛')
    await clickTest('save')
    expect(step()).toContain('核查报名')
    expect(host.querySelector('[data-test=loaded]').textContent).toBe('registrations:27')
    expect(byText('核查完毕，下一步').disabled).toBe(true)
    await clickTest('loaded')
    await click(byText('核查完毕，下一步'))
    expect(step()).toContain('编辑队伍数量')
    expect(creates).toHaveBeenLastCalledWith('teams', { id: 27, year: 2026, season: '秋季赛' })
    await clickTest('save')
    expect(step()).toContain('上传成绩表')
    expect(host.querySelector('[data-test=scores]').textContent).toBe('上传完成：27')
    await clickTest('scores')
    expect(step()).toContain('核查成绩')
    expect(host.querySelector('[data-test=loaded]').textContent).toBe('scores:27')
    await click(byText('完成并返回积分页'))
    expect(replace).not.toHaveBeenCalled()
    await clickTest('loaded')
    await click(byText('完成并返回积分页'))
    expect(replace).toHaveBeenCalledExactlyOnceWith('/points-display')
  })

  it('can go back with the same event, but not while a request is pending', async () => {
    await clickTest('save')
    await clickTest('busy')
    expect(byText('上一步').disabled).toBe(true)
    await click(byText('上一步'))
    expect(step()).toContain('导入报名表')
    await clickTest('release')
    await click(byText('上一步'))
    expect(step()).toContain('创建比赛')
    expect(creates).toHaveBeenLastCalledWith('create', { id: 27, year: 2026, season: '秋季赛' })
    await click(byText('返回赛事清单'))
    expect(replace).toHaveBeenCalledExactlyOnceWith('/event-list')
  })
})
