/**
 * 本地存储封装
 */

const STORAGE_KEY = {
  TOKEN: 'token',
  USER_INFO: 'userInfo',
  RIDER_STATUS: 'riderStatus'
}

export function setToken(token) {
  uni.setStorageSync(STORAGE_KEY.TOKEN, token)
}

export function getToken() {
  return uni.getStorageSync(STORAGE_KEY.TOKEN) || ''
}

export function removeToken() {
  uni.removeStorageSync(STORAGE_KEY.TOKEN)
}

export function setUserInfo(userInfo) {
  uni.setStorageSync(STORAGE_KEY.USER_INFO, JSON.stringify(userInfo))
}

export function getUserInfo() {
  const str = uni.getStorageSync(STORAGE_KEY.USER_INFO)
  return str ? JSON.parse(str) : null
}

export function removeUserInfo() {
  uni.removeStorageSync(STORAGE_KEY.USER_INFO)
}

export function setRiderStatus(status) {
  uni.setStorageSync(STORAGE_KEY.RIDER_STATUS, status)
}

export function getRiderStatus() {
  return uni.getStorageSync(STORAGE_KEY.RIDER_STATUS) || 0
}

export function clearAll() {
  uni.clearStorageSync()
}
