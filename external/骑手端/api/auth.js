/**
 * 认证相关 API
 */
import { post, get, put } from '@/utils/request.js'

/**
 * 登录
 */
export function login(data) {
  return post('/auth/login', data)
}

/**
 * 注册
 */
export function register(data) {
  return post('/auth/register', data)
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return get('/auth/me')
}

/**
 * 更新用户信息
 */
export function updateProfile(data) {
  return put('/auth/profile', data)
}

/**
 * 更新骑手状态
 */
export function updateRiderStatus(data) {
  return post('/order/rider-status', data)
}
