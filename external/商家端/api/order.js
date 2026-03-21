import request from '../utils/request.js'

/**
 * 订单模块接口（商家端）
 */

// 获取商家订单列表
export function getOrderList(params = {}) {
  return request({ url: '/merchant/orders', method: 'GET', data: params })
}

// 获取订单详情
export function getOrderDetail(orderId) {
  return request({ url: '/order/detail/' + orderId, method: 'GET' })
}

// 商家接单
export function acceptOrder(orderId) {
  return request({ url: '/order/accept', method: 'POST', data: { order_id: orderId } })
}

// 商家拒单
export function rejectOrder(orderId, reason = '商品已售罄') {
  return request({ url: '/order/reject', method: 'POST', data: { order_id: orderId, reason: reason } })
}

// 开始备货 / 备货完成
export function prepareOrder(orderId) {
  return request({ url: '/order/prepare', method: 'POST', data: { order_id: orderId } })
}

// 商家发货（派单）
export function deliverOrder(orderId) {
  return request({ url: '/order/deliver', method: 'POST', data: { order_id: orderId } })
}
