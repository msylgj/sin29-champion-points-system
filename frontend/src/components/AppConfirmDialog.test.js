import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive } from 'vue'
import AppConfirmDialog from './AppConfirmDialog.vue'

const mounted = []
const settle = async () => { await nextTick(); await nextTick() }
async function mountDialog(overrides = {}) {
  const root = document.createElement('div')
  const opener = document.createElement('button')
  opener.textContent = '打开确认框'
  document.body.append(opener, root)
  opener.focus()
  const props = reactive({ open: true, title: '确认操作', message: '是否继续？', ...overrides })
  const confirm = vi.fn()
  const cancel = vi.fn()
  const app = createApp({ render: () => h(AppConfirmDialog, { ...props, onConfirm: confirm, onCancel: cancel }) })
  app.mount(root)
  const view = { root, opener, props, confirm, cancel, app, unmounted: false }
  mounted.push(view)
  await settle()
  return view
}
const dialog = () => document.querySelector('[role=dialog]')
const confirmButton = () => document.querySelector('[data-test=confirm-action]')
const cancelButton = () => document.querySelector('[data-test=cancel-action]')
const key = (name, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true })
  document.activeElement.dispatchEvent(event)
  return event
}
afterEach(() => {
  mounted.splice(0).forEach(view => { if (!view.unmounted) view.app.unmount(); view.root.remove(); view.opener.remove() })
  vi.restoreAllMocks()
})

describe('AppConfirmDialog', () => {
  it('teleports to body with accessible labels, safe text and default cancel focus', async () => {
    const view = await mountDialog({ title: '删除规则', message: '<b>规则不可恢复</b>' })
    const panel = dialog()
    expect(view.root.querySelector('[role=dialog]')).toBeNull()
    expect(panel.closest('[data-test=confirm-mask]').parentElement).toBe(document.body)
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(panel.getAttribute('aria-labelledby')).textContent).toBe('删除规则')
    expect(document.getElementById(panel.getAttribute('aria-describedby')).textContent).toBe('<b>规则不可恢复</b>')
    expect(panel.querySelector('b')).toBeNull()
    expect(confirmButton().textContent).toBe('确认')
    expect(cancelButton().textContent).toBe('取消')
    expect(document.activeElement).toBe(cancelButton())
  })

  it('emits confirm with custom labels and danger treatment without closing controlled props itself', async () => {
    const view = await mountDialog({ confirmText: '删除', cancelText: '保留', danger: true })
    expect(confirmButton().textContent).toBe('删除')
    expect(cancelButton().textContent).toBe('保留')
    expect(confirmButton().classList.contains('danger')).toBe(true)
    confirmButton().click()
    expect(view.confirm).toHaveBeenCalledOnce()
    expect(view.cancel).not.toHaveBeenCalled()
    expect(dialog()).not.toBeNull()
  })

  it('emits cancel from the cancel button and Escape key, but not panel clicks', async () => {
    const view = await mountDialog()
    dialog().click()
    expect(view.cancel).not.toHaveBeenCalled()
    cancelButton().click()
    expect(view.cancel).toHaveBeenCalledOnce()
    const event = key('Escape')
    expect(event.defaultPrevented).toBe(true)
    expect(view.cancel).toHaveBeenCalledTimes(2)
    expect(view.confirm).not.toHaveBeenCalled()
  })

  it('cancels only direct mask clicks', async () => {
    const view = await mountDialog()
    dialog().querySelector('h3').click()
    expect(view.cancel).not.toHaveBeenCalled()
    document.querySelector('[data-test=confirm-mask]').click()
    expect(view.cancel).toHaveBeenCalledOnce()
  })

  it('cycles Tab and Shift+Tab inside the dialog and prevents outside focus', async () => {
    const view = await mountDialog()
    expect(key('Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(confirmButton())
    key('Tab')
    expect(document.activeElement).toBe(cancelButton())
    key('Tab', true)
    expect(document.activeElement).toBe(confirmButton())
    key('Tab', true)
    expect(document.activeElement).toBe(cancelButton())
    view.opener.focus()
    expect(document.activeElement).toBe(cancelButton())
  })

  it('blocks every action while busy and traps focus on the panel until buttons are available', async () => {
    const view = await mountDialog({ busy: true })
    expect(dialog().getAttribute('aria-busy')).toBe('true')
    expect(confirmButton().disabled).toBe(true)
    expect(cancelButton().disabled).toBe(true)
    expect(document.activeElement).toBe(dialog())
    confirmButton().click()
    cancelButton().click()
    document.querySelector('[data-test=confirm-mask]').click()
    key('Escape')
    key('Tab')
    expect(document.activeElement).toBe(dialog())
    expect(view.confirm).not.toHaveBeenCalled()
    expect(view.cancel).not.toHaveBeenCalled()
    view.props.busy = false
    await settle()
    expect(document.activeElement).toBe(cancelButton())
    expect(confirmButton().disabled).toBe(false)
    confirmButton().click()
    expect(view.confirm).toHaveBeenCalledOnce()
  })

  it('moves focus to the panel when an open dialog becomes busy', async () => {
    const view = await mountDialog()
    confirmButton().focus()
    view.props.busy = true
    await settle()
    expect(document.activeElement).toBe(dialog())
    expect(cancelButton().disabled).toBe(true)
  })

  it('restores opener focus on close and reopens cleanly with no listener leak', async () => {
    const view = await mountDialog()
    view.props.open = false
    await settle()
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(view.opener)
    expect(key('Tab').defaultPrevented).toBe(false)
    key('Escape')
    expect(view.cancel).not.toHaveBeenCalled()
    view.props.open = true
    await settle()
    expect(document.activeElement).toBe(cancelButton())
    key('Escape')
    expect(view.cancel).toHaveBeenCalledOnce()
  })

  it.each(['disabled', 'hidden', 'removed'])('falls back to refresh when the opener is %s', async state => {
    const view = await mountDialog()
    const fallback = document.createElement('button')
    fallback.dataset.test = 'reload-rules'
    view.root.appendChild(fallback)
    if (state === 'disabled') view.opener.disabled = true
    if (state === 'hidden') view.opener.hidden = true
    if (state === 'removed') view.opener.remove()
    view.props.open = false
    await settle()
    expect(document.activeElement).toBe(fallback)
  })

  it('waits for pending API controls to become available before restoring fallback focus', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const view = await mountDialog()
    const fallback = document.createElement('button')
    fallback.dataset.test = 'reload-rules'
    fallback.disabled = true
    view.root.appendChild(fallback)
    view.opener.remove()
    view.props.open = false
    await settle()
    expect(document.activeElement).not.toBe(fallback)
    fallback.disabled = false
    await settle()
    expect(document.activeElement).toBe(fallback)
    expect(disconnect).toHaveBeenCalled()
  })

  it('honors a synchronously captured returnFocus even when active focus already fell to body', async () => {
    const view = await mountDialog({ open: false })
    view.props.returnFocus = view.opener
    view.opener.blur()
    expect(document.activeElement).toBe(document.body)
    view.props.open = true
    await settle()
    expect(document.activeElement).toBe(cancelButton())
    view.props.returnFocus = null
    view.props.open = false
    await settle()
    expect(document.activeElement).toBe(view.opener)
  })

  it('does not mistake browser body focus after a disabled opener for a successful restoration', async () => {
    const view = await mountDialog({ open: false })
    const fallback = document.createElement('button')
    fallback.dataset.test = 'reload-rules'
    fallback.disabled = true
    view.root.appendChild(fallback)
    view.opener.blur()
    view.opener.disabled = true
    expect(document.activeElement).toBe(document.body)
    view.props.open = true
    await settle()
    view.props.open = false
    await settle()
    fallback.disabled = false
    await settle()
    expect(document.activeElement).toBe(fallback)
  })

  it('cleans a pending restoration observer on unmount instead of stealing focus later', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe')
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const view = await mountDialog()
    const fallback = document.createElement('button')
    fallback.dataset.test = 'reload-rules'
    fallback.disabled = true
    view.root.appendChild(fallback)
    view.opener.remove()
    view.props.open = false
    await settle()
    const observer = observe.mock.contexts.at(-1)
    expect(observer).toBeInstanceOf(MutationObserver)
    view.app.unmount()
    view.unmounted = true
    expect(disconnect.mock.contexts).toContain(observer)
    fallback.disabled = false
    await settle()
    expect(document.activeElement).not.toBe(fallback)
  })

  it('renders nothing when closed and focuses cancel after being opened later', async () => {
    const view = await mountDialog({ open: false })
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(view.opener)
    view.props.open = true
    await settle()
    expect(document.activeElement).toBe(cancelButton())
  })

  it('removes document listeners and restores focus even if unmounted while busy', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const view = await mountDialog({ busy: true })
    const keyHandler = add.mock.calls.find(([type]) => type === 'keydown')[1]
    const focusHandler = add.mock.calls.find(([type]) => type === 'focusin')[1]
    view.app.unmount()
    view.unmounted = true
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(view.opener)
    expect(remove).toHaveBeenCalledWith('keydown', keyHandler, true)
    expect(remove).toHaveBeenCalledWith('focusin', focusHandler, true)
    expect(key('Escape').defaultPrevented).toBe(false)
    expect(view.cancel).not.toHaveBeenCalled()
  })
})
