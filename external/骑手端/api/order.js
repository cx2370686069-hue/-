/**
 * 订单相关 API
 */
import { get, post } from '../utils/request.js'

/**
 * 获取骑手工作台订单（派单模式下返回我的订单）
 */
export function getAvailableOrders(params = {}) {
  return get('/order/available', params)
}

/**
 * 获取我的配送订单
 * @param {object} params - 查询参数
 */
export function getRiderOrders(params = {}) {
  return get('/order/rider-orders', params)
}

/**
 * 获取订单详情
 */
export function getOrderDetail(id) {
  return get('/order/detail/' + id)
}

/**
 * 确认送达
 */
export function confirmDelivery(orderId) {
  return post('/order/confirm-delivery', { order_id: orderId })
}

/**
 * 更新骑手状态
 */
export function updateRiderStatus(status) {
  return post('/order/rider-status', { status: status })
}
