const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'
const MERCHANT_KEYS = ['merchantInfo', 'merchant_info', 'shopInfo', 'shop_info']

export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function getUser() {
  return uni.getStorageSync(USER_KEY) || null
}

export function setUser(info) {
  uni.setStorageSync(USER_KEY, info)
}

export function isLoggedIn() {
  return !!(getToken() && getUser())
}

export function normalizeUserRole(userInfo) {
  if (!userInfo || typeof userInfo !== 'object') return ''
  const candidates = [
    userInfo.role,
    userInfo.Role,
    userInfo.user_role,
    userInfo.userRole,
    userInfo.type,
    userInfo.user_type,
    userInfo.userType,
    userInfo.account_type,
    userInfo.accountType,
    userInfo.identity,
    userInfo['角色']
  ]
  for (const value of candidates) {
    const role = String(value || '').trim().toLowerCase()
    if (!role) continue
    if (role === 'merchant' || role === 'shop' || role === '商家') {
      return 'merchant'
    }
  }
  return ''
}

export function getUserId(userInfo = getUser()) {
  if (!userInfo || typeof userInfo !== 'object') return ''
  return userInfo.id || userInfo.userId || userInfo.user_id || userInfo.uid || ''
}

export function isMerchantUser(userInfo = getUser()) {
  return normalizeUserRole(userInfo) === 'merchant'
}

export function hasValidMerchantSession() {
  const token = getToken()
  const userInfo = getUser()
  return !!(token && getUserId(userInfo) && isMerchantUser(userInfo))
}

export function clearAuth() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  MERCHANT_KEYS.forEach((key) => uni.removeStorageSync(key))
}

export function requireLogin(callback) {
  if (!hasValidMerchantSession()) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1000)
    return false
  }
  if (callback) callback()
  return true
}
