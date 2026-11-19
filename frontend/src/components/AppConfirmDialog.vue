<template>
  <Teleport to="body">
    <div v-if="open" class="app-confirm-mask" data-test="confirm-mask" @click.self="cancel">
      <section ref="panel" class="app-confirm-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-describedby="messageId" :aria-busy="busy" tabindex="-1">
        <h3 :id="titleId">{{ title }}</h3>
        <p :id="messageId" class="app-confirm-tip">{{ message }}</p>
        <slot />
        <div class="app-confirm-actions">
          <button ref="cancelButton" type="button" class="app-confirm-cancel" data-test="cancel-action" :disabled="busy" @click="cancel">{{ cancelText }}</button>
          <button type="button" class="app-confirm-submit" :class="{ danger }" data-test="confirm-action" :disabled="busy || confirmDisabled" @click="confirm">{{ confirmText }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: Boolean,
  busy: Boolean,
  confirmDisabled: Boolean,
  returnFocus: { type: Object, default: null },
  fallbackFocus: { type: Object, default: null },
})
const emit = defineEmits(['confirm', 'cancel'])
const id = useId()
const titleId = 'app-confirm-title-' + id
const messageId = 'app-confirm-message-' + id
const panel = ref(null)
const cancelButton = ref(null)
let previousFocus = null
let disposed = false
let restoreObserver = null

const stopRestoreObserver = () => { restoreObserver?.disconnect(); restoreObserver = null }
const canFocus = element => {
  if (!(element instanceof HTMLElement) || element === document.body || element === document.documentElement || !element.isConnected || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}
const restoreFocus = original => {
  const target = canFocus(original) ? original : props.fallbackFocus || document.querySelector('[data-test="reload-rules"]')
  if (!canFocus(target)) return false
  target.focus()
  return document.activeElement === target
}

const focusDefault = () => {
  if (props.busy) panel.value?.focus()
  else cancelButton.value?.focus()
}
const confirm = () => { if (props.open && !props.busy && !props.confirmDisabled) emit('confirm') }
const cancel = () => { if (props.open && !props.busy) emit('cancel') }
const handleKeydown = event => {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancel()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    const controls = props.busy ? [] : [...(panel.value?.querySelectorAll('button, input, select, textarea, a[href], [tabindex]') || [])]
      .filter(control => control.tabIndex >= 0 && canFocus(control))
    if (!controls.length) { panel.value?.focus(); return }
    const current = controls.indexOf(document.activeElement)
    const next = event.shiftKey
      ? (current <= 0 ? controls.length - 1 : current - 1)
      : (current + 1) % controls.length
    controls[next].focus()
  }
}
const containFocus = event => {
  if (props.open && panel.value && !panel.value.contains(event.target)) focusDefault()
}
const release = () => {
  document.removeEventListener('keydown', handleKeydown, true)
  document.removeEventListener('focusin', containFocus, true)
  stopRestoreObserver()
  const original = previousFocus
  previousFocus = null
  if (!original || restoreFocus(original) || disposed) return
  // API actions can keep the opener and refresh button disabled after closing
  // the dialog. Restore once controls become usable; never poll or keep a
  // pending observer after reopening/unmounting the component.
  restoreObserver = new MutationObserver(() => {
    if (disposed || props.open || restoreFocus(original)) stopRestoreObserver()
  })
  restoreObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'inert', 'aria-hidden', 'style', 'class'] })
}
watch(() => props.open, async open => {
  if (!open) { release(); return }
  stopRestoreObserver()
  previousFocus = props.returnFocus || document.activeElement
  document.addEventListener('keydown', handleKeydown, true)
  document.addEventListener('focusin', containFocus, true)
  await nextTick()
  if (props.open && !disposed) focusDefault()
}, { immediate: true, flush: 'post' })
watch(() => props.busy, async () => {
  await nextTick()
  if (props.open && !disposed) focusDefault()
})
onBeforeUnmount(() => { disposed = true; release() })
</script>

<style scoped lang="scss">
@use '../styles/feedback';

.app-confirm-mask { @include feedback.dialog-mask; }
.app-confirm-dialog { @include feedback.dialog-panel; }
.app-confirm-dialog h3 { @include feedback.dialog-title; }
.app-confirm-tip {
  @include feedback.dialog-tip;
  white-space: pre-wrap;
  word-break: break-word;
}
.app-confirm-actions { @include feedback.dialog-actions; }
.app-confirm-actions button { @include feedback.dialog-button; }
.app-confirm-cancel { @include feedback.dialog-cancel-button; }
.app-confirm-submit { @include feedback.dialog-confirm-button; }
.app-confirm-submit.danger { @include feedback.dialog-confirm-button($danger: true); }
.app-confirm-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
