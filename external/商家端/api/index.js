/**
 * API 接口统一管理
 * 后端接口地址：由 config/index.js 的 BASE_URL + /api（与 BASE_URL 保持一致）
 */

import request from '../utils/request.js';

// ========== 商家登录（使用用户端的 auth 接口） ==========
export function login(data) {
  return request({ url: '/auth/login', method: 'POST', data });
}

// ========== 工作台统计 ==========
export function getDashboard() {
  return request({ url: '/shop/dashboard', method: 'GET' });
}

// ========== 订单 ==========
// 获取商家订单列表
export function getOrderList(params) {
  return request({ url: '/order/my', method: 'GET', data: params });
}

// 获取订单详情（使用用户端 order 接口）
export function getOrderDetail(id) {
  return request({ url: '/order/detail/' + id, method: 'GET' });
}

// 商家接单
export function acceptOrder(id, data = {}) {
  return request({ url: '/order/accept', method: 'POST', data: { order_id: id, ...data } });
}

// 商家拒单
export function rejectOrder(id, data) {
  return request({ url: '/order/reject', method: 'POST', data: { order_id: id, reason: data?.reason || '商品已售罄' } });
}

// 出餐完成：状态 2 -> 3（POST /api/order/prepare）
export function prepareOrder(id) {
  return request({ url: '/order/prepare', method: 'POST', data: { order_id: id } });
}

// 兼容旧名
export function startMaking(id) {
  return prepareOrder(id);
}

export function readyForDelivery(id) {
  return prepareOrder(id);
}

// 县城订单呼叫骑手 / 提交调度：POST /api/order/deliver
export function deliverOrder(id) {
  return request({ url: '/order/deliver', method: 'POST', data: { order_id: id } });
}

// ========== 商品 ==========
// 获取商品列表（非本店维度时请改用 getMyProducts）
export function getProductList(params) {
  return request({ url: '/merchant/products', method: 'GET', data: params });
}

/** 当前商家店铺商品 GET /api/merchant/my-products */
export function getMyProducts(params) {
  return request({ url: '/merchant/my-products', method: 'GET', data: params || {} });
}

// 获取商品详情（后端可能不支持，先保留）
export function getProductDetail(id) {
  return request({ url: '/merchant/products', method: 'GET', data: { id } });
}

// 创建商品
export function createProduct(data) {
  return request({ url: '/product', method: 'POST', data });
}

// 更新商品
export function updateProduct(id, data) {
  return request({ url: '/merchant/product/' + id, method: 'PUT', data });
}

// 删除商品（后端暂未实现，先保留）
export function deleteProduct(id) {
  return request({ url: '/merchant/product/' + id, method: 'DELETE' });
}

// 更新商品状态（上下架）
export function updateProductStatus(id, status) {
  return request({ url: '/merchant/product/' + id, method: 'PUT', data: { status } });
}

// ========== 店铺 ==========
// 获取我的店铺
export function getShopInfo() {
  return request({ url: '/merchant/my', method: 'GET' });
}

// 更新店铺信息
export function updateShopInfo(data) {
  return request({ url: '/merchant/update', method: 'PUT', data });
}

// 创建店铺信息
export function createShop(data) {
  return request({ url: '/merchant/create', method: 'POST', data });
}

// 更新店铺营业状态
export function updateShopStatus(status) {
  return request({ url: '/merchant/update', method: 'PUT', data: { status } });
}

// ========== 财务 ==========
export function getFinanceStats(params) {
  return request({ url: '/merchant/finance/stats', method: 'GET', data: params });
}

export function getWithdrawList(params) {
  return request({ url: '/merchant/finance/withdraw', method: 'GET', data: params });
}

export function applyWithdraw(data) {
  return request({ url: '/merchant/finance/withdraw', method: 'POST', data });
}

// ========== 统计 ==========
export function getStatsData(params) {
  return request({ url: '/merchant/stats', method: 'GET', data: params });
}

// 获取热销商品
export function getHotProducts() {
  return request({ url: '/merchant/hot-products', method: 'GET' });
}

// ========== 评价 ==========
export function getReviewList(params) {
  return request({ url: '/merchant/reviews', method: 'GET', data: params });
}

export function replyReview(orderId, data) {
  return request({ url: '/merchant/reviews/' + orderId + '/reply', method: 'POST', data });
}
