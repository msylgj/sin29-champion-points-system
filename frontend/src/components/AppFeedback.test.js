import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive } from 'vue'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import * as sass from 'sass'
import AppFeedback from './AppFeedback.vue'

const mounted = []
const mountFeedback = (initial = {}) => {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const props = reactive(initial)
  const app = createApp({ render: () => h(AppFeedback, props) })
  app.mount(root)
  mounted.push({ app, root })
  return { root, props }
}
afterEach(() => { mounted.splice(0).forEach(({ app, root }) => { app.unmount(); root.remove() }) })

describe('AppFeedback', () => {
  it('renders nothing for empty feedback', () => {
    const { root } = mountFeedback()
    expect(root.querySelector('.success-message')).toBeNull()
    expect(root.querySelector('.error-message')).toBeNull()
  })
  it('uses the original success/error classes, accessible live regions and text escaping', () => {
    const { root } = mountFeedback({ success: '规则保存成功', error: '<b>失败详情</b>\n请刷新' })
    expect(root.querySelector('.success-message').textContent).toBe('规则保存成功')
    expect(root.querySelector('.success-message').getAttribute('role')).toBe('status')
    expect(root.querySelector('.error-message').textContent).toBe('<b>失败详情</b>\n请刷新')
    expect(root.querySelector('.error-message').getAttribute('role')).toBe('alert')
    expect(root.querySelector('.error-message').getAttribute('aria-live')).toBe('assertive')
    expect(root.querySelector('b')).toBeNull()
  })
  it('reacts to message updates and removes cleared messages', async () => {
    const { root, props } = mountFeedback({ success: '已完成', error: '' })
    props.success = ''
    props.error = '请求失败'
    await nextTick()
    expect(root.querySelector('.success-message')).toBeNull()
    expect(root.querySelector('.error-message').textContent).toBe('请求失败')
    props.error = ''
    await nextTick()
    expect(root.querySelector('[role=alert]')).toBeNull()
  })
})

describe('shared feedback Sass visual contract', () => {
  // SHA256 of expanded CSS captured immediately before extraction. Matching
  // whole-page output ensures colors, geometry, declaration order, selectors,
  // animations and prior managementControls mixins remain byte-for-byte equal.
  it.each([
    ['PointsDisplay.scss', '313c35d0356cee6f0735005c3604657fa9fdd3d704a86c8fc5fb22a954612da8'],
    ['ScoreManagePanel.scss', '02445bf83cd325485f48f3b5602bb6fbf6f01bf393a98ee841b4dc63002e67a1'],
    ['EventAdd.scss', '13c5771df7e6e248b41379f34efb2d4f2a24c3cf4ead9ecc2c313f2211246a3c'],
    ['ScoreImport.scss', 'a4b515b7510ef173e2855893da5777fdc9d4616554f4b87e78c49c3b9b102eec'],
    ['EventRegistrationManagePanel.scss', '2f54db7ca7edb3f522bfd83d97559b3ba5fa7c6ee2dbef67f06f5c5940c8652a'],
  ])('keeps the original compiled %s CSS unchanged', (filename, expectedHash) => {
    const css = sass.compile(resolve('src/styles', filename), { style: 'expanded' }).css
    expect(createHash('sha256').update(css).digest('hex')).toBe(expectedHash)
  })

  it('copies EventAdd failure/retry blocks and ScoreManagePanel empty tips exactly', () => {
    const css = sass.compileString("@use 'feedback'; .failure-notice { @include feedback.failure-notice; } .btn-retry-inline { @include feedback.retry-button; } .empty-tip { @include feedback.empty-tip; }", { loadPaths: [resolve('src/styles')] }).css
    const eventCss = sass.compile(resolve('src/styles/EventAdd.scss')).css
    const scoreCss = sass.compile(resolve('src/styles/ScoreManagePanel.scss')).css
    const rules = value => value.match(/\.(?:failure-notice(?: strong| p)?|btn-retry-inline|empty-tip) \{[^}]*\}/g)
    expect(rules(css)).toEqual([...rules(eventCss), ...rules(scoreCss)])
  })

  it('keeps the new feedback layer below the modal without changing legacy CSS', () => {
    const path = resolve('src/components/AppFeedback.vue')
    const source = readFileSync(path, 'utf8')
    const styleBlock = source.slice(source.indexOf('<style'))
    const style = styleBlock.slice(styleBlock.indexOf('>') + 1, styleBlock.indexOf('</style>'))
    const css = sass.compileString(style, { url: pathToFileURL(path) }).css
    expect(css).toContain('z-index: 998')
  })

  it('exposes the exact dialog and floating-message geometry and existing colors', () => {
    const css = sass.compileString("@use 'feedback'; .mask { @include feedback.dialog-mask; } .panel { @include feedback.dialog-panel; } .title { @include feedback.dialog-title; } .tip { @include feedback.dialog-tip; } .actions { @include feedback.dialog-actions; } .button { @include feedback.dialog-button; } .success { @include feedback.floating-message(150px, #2ed573); } .error { @include feedback.floating-message(200px, #ff4757); } @include feedback.floating-animation;", { loadPaths: [resolve('src/styles')] }).css
    for (const value of ['rgba(0, 0, 0, 0.42)', 'z-index: 999', 'width: min(420px, 100%)', 'border-radius: 10px', 'padding: 18px', 'bottom: 90px', 'left: 15px', 'right: 15px', 'padding: 12px 15px', '#2ed573', '#ff4757', 'max-height: 150px', 'max-height: 200px', 'overflow-y: auto', '@keyframes slideUp']) expect(css).toContain(value)
  })
})
