import request from '../utils/request.js'

/**
 * 用户认证接口（商家端）
 */

/**
 * 商家注册
 */
export function register(data) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data: {
      phone: data.phone,
      password: data.password,
      nickname: data.nickname,
      role: 'merchant'
    }
  })
}

/**
 * 商家登录
 */
export function login(data) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: {
      phone: data.phone,
      password: data.password
    }
  })
}

/**
 * 获取当前用户信息
 */
export function getUserInfo() {
  return request({ url: '/auth/me', method: 'GET' })
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  return request({
    url: '/auth/profile',
    method: 'PUT',
    data: {
      nickname: data.nickname,
      avatar: data.avatar
    }
  })
}
