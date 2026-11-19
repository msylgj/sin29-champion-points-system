import { ref } from 'vue'

const TOKEN_KEY = 'admin_auth_token'
const REQUIRED_KEY = 'admin_auth_required'
const REDIRECT_KEY = 'admin_auth_redirect'
export const EVENT_LIST_PATH = '/event-list'
const DEFAULT_REDIRECT = EVENT_LIST_PATH
const ADMIN_PATHS = new Set([EVENT_LIST_PATH, '/event-add', '/score-import', '/scoring-rules', '/work-wizard'])

function readStorage(storage, key) {
  try {
    return globalThis[storage]?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value === null) globalThis[storage]?.removeItem(key)
    else globalThis[storage]?.setItem(key, value)
  } catch {
    // Storage may be unavailable; reactive recovery must still work in this page.
  }
}

export function sanitizeAdminRedirect(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return DEFAULT_REDIRECT
  if (Array.from(target).some(char => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return DEFAULT_REDIRECT
  // Match the original path exactly, before any URL decoding/normalization. Encoded slash,
  // dot-segments and look-alike routes cannot become an open redirect or bypass the allowlist.
  const path = target.split(/[?#]/, 1)[0]
  return ADMIN_PATHS.has(path) ? target : DEFAULT_REDIRECT
}

function restoredRequest() {
  if (readStorage('sessionStorage', REQUIRED_KEY) !== '1') return null
  return { redirect: sanitizeAdminRedirect(readStorage('sessionStorage', REDIRECT_KEY)) }
}

export const adminAuthRequest = ref(restoredRequest())
let observedToken = readStorage('localStorage', TOKEN_KEY)
let generation = 0
let discardedTokenSession = null
let coordinator = null
let homeNavigation = null

function syncToken() {
  const token = readStorage('localStorage', TOKEN_KEY)
  if (token !== observedToken) {
    observedToken = token
    generation += 1
    discardedTokenSession = null
  }
  return token
}

function removeToken() {
  discardedTokenSession = null
  writeStorage('localStorage', TOKEN_KEY, null)
  observedToken = null
  generation += 1
}

function decodePart(part) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const text = decodeURIComponent(Array.from(binary, char => '%' + char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
  return JSON.parse(text)
}

function isUsableToken(token) {
  // This is only an expiry/shape check for UX. Only the backend verifies the signature.
  if (typeof token !== 'string' || token.length > 16384) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1)) return false
  try {
    const header = decodePart(parts[0])
    const payload = decodePart(parts[1])
    if (!header || Array.isArray(header) || typeof header.alg !== 'string' || !header.alg || header.alg === 'none') return false
    if (!payload || Array.isArray(payload) || payload.sub !== 'admin') return false
    const now = Date.now() / 1000
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= now) return false
    if ('nbf' in payload && (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf) || payload.nbf > now)) return false
    return true
  } catch {
    return false
  }
}

export function getValidAdminToken() {
  const token = syncToken()
  if (token === null) return null
  if (isUsableToken(token)) return token
  const discarded = { token, generation }
  removeToken()
  // A public request may notice expiry before an in-flight private request returns 401.
  // Keep only that exact discarded session eligible until a login/recovery/cancel replaces it.
  discardedTokenSession = { ...discarded, clearedGeneration: generation }
  return null
}

export function clearAdminAuthRequest() {
  if (adminAuthRequest.value) generation += 1
  discardedTokenSession = null
  adminAuthRequest.value = null
  writeStorage('sessionStorage', REQUIRED_KEY, null)
  writeStorage('sessionStorage', REDIRECT_KEY, null)
}

export function saveAdminToken(token) {
  if (!isUsableToken(token)) throw new Error('管理员凭证无效或已过期，请重新验证口令')
  writeStorage('localStorage', TOKEN_KEY, token)
  observedToken = token
  // Saving even an identical JWT is a new session (backend tokens can match within one second).
  generation += 1
  clearAdminAuthRequest()
}

// Router calls this state-only variant from beforeEach, then returns its own replace redirect.
// Starting router.replace inside a running guard would cause competing navigations.
export function markAdminAuthenticationRequired(target) {
  if (!adminAuthRequest.value) adminAuthRequest.value = { redirect: sanitizeAdminRedirect(target) }
  writeStorage('sessionStorage', REQUIRED_KEY, '1')
  writeStorage('sessionStorage', REDIRECT_KEY, adminAuthRequest.value.redirect)
  return adminAuthRequest.value
}

export function registerAdminAuthRouter(router) {
  coordinator = router
  return () => {
    if (coordinator === router) coordinator = null
  }
}

export function getAdminAuthRedirect() {
  const route = coordinator?.currentRoute?.value
  if (ADMIN_PATHS.has(route?.path)) return sanitizeAdminRedirect(route.fullPath)
  return adminAuthRequest.value?.redirect || DEFAULT_REDIRECT
}

export function requestAdminAuthentication(target) {
  markAdminAuthenticationRequired(target)
  if (!coordinator || coordinator.currentRoute.value.path === '/points-display') return Promise.resolve()
  if (!homeNavigation) {
    homeNavigation = Promise.resolve().then(() => {
      if (adminAuthRequest.value && coordinator && coordinator.currentRoute.value.path !== '/points-display') {
        return coordinator.replace('/points-display')
      }
    }).catch(() => {
      // The auth request remains published even if a navigation is cancelled/replaced.
    }).finally(() => {
      homeNavigation = null
    })
  }
  return homeNavigation
}

export function getAdminSessionSnapshot() {
  const token = getValidAdminToken()
  return { token, generation }
}

export function recoverAdminUnauthorized(snapshot, target) {
  const currentToken = syncToken()
  if (!snapshot) return false
  const matchesCurrent = snapshot.generation === generation && snapshot.token === currentToken
  const matchesDiscarded = currentToken === null && discardedTokenSession &&
    snapshot.token === discardedTokenSession.token && snapshot.generation === discardedTokenSession.generation &&
    generation === discardedTokenSession.clearedGeneration
  if (!matchesCurrent && !matchesDiscarded) return false
  // Changing the generation also coalesces no-token requests and protects a cancelled dialog
  // from being reopened by a delayed 401 from the same failed batch.
  removeToken()
  void requestAdminAuthentication(target)
  return true
}
