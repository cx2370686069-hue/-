const fs = require('fs');

console.log('========================================');
console.log('   前端API接口修复脚本');
console.log('========================================\n');

// 用户端 api/order.js 内容
const userOrderApi = `import { get, post } from '../utils/request.js'

/**
 * 订单模块接口
 */

// 创建订单
export function createOrder(data) {
  return post('/order/create', {
    merchant_id: data.merchant_id,
    type: data.type || 'takeout',
    order_type: data.order_type,
    customer_town: data.customer_town,
    products_info: data.products_info,
    total_amount: data.total_amount,
    delivery_fee: data.delivery_fee || 0,
    package_fee: data.package_fee || 0,
    discount_amount: data.discount_amount || 0,
    delivery_type: data.delivery_type || 1,
    contact_phone: data.contact_phone,
    contact_name: data.contact_name,
    delivery_address: data.delivery_address,
    delivery_latitude: data.delivery_latitude,
    delivery_longitude: data.delivery_longitude,
    remark: data.remark || ''
  })
}

// 获取我的订单列表
export function getOrderList(params = {}) {
  return get('/order/my', params)
}

// 获取订单详情
export function getOrderDetail(orderId) {
  return get('/order/detail/' + orderId)
}

// 支付订单
export function payOrder(orderId, payMethod = 'mock') {
  return post('/order/pay', {
    order_id: orderId,
    channel: payMethod
  })
}

// 取消订单
export function cancelOrder(orderId, reason = '') {
  return post('/order/cancel', {
    order_id: orderId,
    reason: reason
  })
}

// 商家接单（用户端调用查看）
export function acceptOrder(orderId) {
  return post('/order/accept', { order_id: orderId })
}

// 商家发货
export function deliverOrder(orderId) {
  return post('/order/deliver', { order_id: orderId })
}

// 骑手确认送达
export function confirmOrder(orderId) {
  return post('/order/confirm-delivery', { order_id: orderId })
}
`;

// 商家端 api/order.js 内容
const merchantOrderApi = `import request from '../utils/request.js'

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
`;

// 骑手端 api/order.js 内容（已正确，保持不变）
const riderOrderApi = `/**
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
`;

// 修复用户端
console.log('[1/3] 正在修复用户端 api/order.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖前端\\api\\order.js', userOrderApi, 'utf8');
  console.log('    √ 用户端修复成功！');
} catch (err) {
  console.log('    × 用户端修复失败:', err.message);
}

console.log('');

// 修复商家端
console.log('[2/3] 正在修复商家端 api/order.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖商家端\\api\\order.js', merchantOrderApi, 'utf8');
  console.log('    √ 商家端修复成功！');
} catch (err) {
  console.log('    × 商家端修复失败:', err.message);
}

console.log('');

// 修复骑手端
console.log('[3/3] 正在修复骑手端 api/order.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖骑手端\\api\\order.js', riderOrderApi, 'utf8');
  console.log('    √ 骑手端修复成功！');
} catch (err) {
  console.log('    × 骑手端修复失败:', err.message);
}

console.log('');
console.log('========================================');
console.log('   修复完成！');
console.log('========================================');
console.log('');
console.log('修复内容：');
console.log('  1. 用户端：修正API路径和参数名');
console.log('  2. 商家端：修正中文参数名为英文');
console.log('  3. 骑手端：修正参数名格式');
