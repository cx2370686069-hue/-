import request from '../utils/request.js'

/**
 * 订单模块接口（商家端）
 */

// 创建订单
export function createOrder(data) {
  return request({ url: '/order/create', method: 'POST', data })
}

// 支付订单
export function payOrder(orderId, payMethod) {
  return request({ url: '/order/pay', method: 'POST', data: { order_id: orderId, pay_method: payMethod } })
}

// 获取商家订单列表
export function getOrderList(params = {}) {
  return request({ url: '/order/my', method: 'GET', data: params })
}

// 获取订单详情
export function getOrderDetail(orderId) {
  return request({ url: '/order/detail/' + orderId, method: 'GET' })
}

// 商家接单
export function acceptOrder(orderId, data = {}) {
  return request({ url: '/order/accept', method: 'POST', data: { order_id: orderId, ...data } })
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

// 商家或用户取消订单
export function cancelOrder(orderId) {
  return request({ url: '/order/cancel', method: 'POST', data: { order_id: orderId } })
}

// 用户确认收货
export function confirmOrder(orderId) {
  return request({ url: '/order/confirm', method: 'POST', data: { order_id: orderId } })
}
