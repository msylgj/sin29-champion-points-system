import { ref, onUnmounted } from 'vue'

/**
 * 统一消息管理 composable
 * @param {number} autoHideMs - 自动隐藏时间（毫秒），0 表示不自动隐藏
 */
export function useMessage(autoHideMs = 0) {
  const successMsg = ref('')
  const errorMsg = ref('')
  let timer = null

  const clear = () => {
    successMsg.value = ''
    errorMsg.value = ''
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const show = (type, message) => {
    clear()
    if (type === 'success') {
      successMsg.value = message
    } else {
      errorMsg.value = message
    }
    if (autoHideMs > 0) {
      timer = setTimeout(clear, autoHideMs)
    }
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { successMsg, errorMsg, show, clear }
}
