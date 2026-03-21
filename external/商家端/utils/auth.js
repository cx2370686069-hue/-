const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'

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

export function clearAuth() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}

export function requireLogin(callback) {
  if (!isLoggedIn()) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.navigateTo({ url: '/pages/login/index' })
    }, 1000)
    return false
  }
  if (callback) callback()
  return true
}
