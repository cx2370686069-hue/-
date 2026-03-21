/**
 * 用户相关 API
 */
import { get, put, post } from '@/utils/request.js'

/**
 * 获取用户信息（使用 /auth/me 接口）
 */
export function getUserInfo() {
  return get('/auth/me')
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  return put('/auth/profile', data)
}

/**
 * 获取骑手余额（从用户信息中获取）
 */
export function getRiderBalance() {
  return get('/auth/me')
}

export function bindStationTown(town) {
  return post('/rider/station/bind', { town })
}
