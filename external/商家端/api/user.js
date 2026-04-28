import request from '../utils/request.js'

/**
 * 用户认证接口（商家端）
 */

function normalizeCoordinateValue(value) {
  if (value == null) return null
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '') return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

function getValidCoordinatePair(latitude, longitude) {
  const lat = normalizeCoordinateValue(latitude)
  const lng = normalizeCoordinateValue(longitude)
  if (lat == null || lng == null) return null
  if (lat === 0 && lng === 0) return null
  return {
    latitude: lat,
    longitude: lng
  }
}

/**
 * 商家专用注册 POST /api/auth/register/merchant
 * county_food：不传 town_code；town_food：须传 town_code
 */
export function registerMerchant(data) {
  const coordinatePair = getValidCoordinatePair(data.latitude, data.longitude)
  if (!coordinatePair) {
    throw new Error('地图坐标无效，请重新选点后再提交')
  }
  const body = {
    phone: data.phone,
    password: data.password,
    store_name: data.store_name,
    address: data.address,
    latitude: coordinatePair.latitude,
    longitude: coordinatePair.longitude,
    category: data.category,
    business_scope: data.business_scope,
    business_license: data.business_license
  }
  if (data.category === '超市' && data.supermarket_delivery_permission) {
    body.supermarket_delivery_permission = data.supermarket_delivery_permission
  }
  if (data.category === '超市' && data.channel_tags) {
    body.channel_tags = data.channel_tags
  }
  if (data.business_scope === 'town_food' && data.town_code) {
    body.town_code = data.town_code
  }
  console.log('[merchant-register][request-body]', body)
  return request({
    url: '/auth/register/merchant',
    method: 'POST',
    data: body
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
