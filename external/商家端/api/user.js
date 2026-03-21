import { post, get, put } from '../utils/request.js'

/**
 * 用户认证接口（商家端）
 */

/**
 * 商家注册
 */
export function register(data) {
  return post('/auth/register', {
    phone: data.phone,
    password: data.password,
    nickname: data.nickname,
    role: 'merchant'
  })
}

/**
 * 商家登录
 */
export function login(data) {
  return post('/auth/login', {
    phone: data.phone,
    password: data.password
  })
}

/**
 * 获取当前用户信息
 */
export function getUserInfo() {
  return get('/auth/me')
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  return put('/auth/profile', {
    nickname: data.nickname,
    avatar: data.avatar
  })
}
