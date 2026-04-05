import request from '../utils/request.js'

/**
 * 店铺模块接口（商家端）
 */

// 获取当前商家店铺信息
export function getShopInfo() {
  return request({ url: '/merchant/my', method: 'GET' })
}

/** GET /api/merchant/my，404 时不弹窗，返回 null（用于判断是否已开店） */
export function fetchMerchantMy() {
  return request({ url: '/merchant/my', method: 'GET', allow404: true })
}

// 创建店铺信息 (就是缺了这个！！)
export function createShop(data) {
  return request({ url: '/merchant/create', method: 'POST', data: data })
}

// 更新店铺信息
export function updateShopInfo(data) {
  return request({ url: '/merchant/update', method: 'PUT', data: data })
}

// 切换营业状态
export function toggleShopStatus(status) {
  return request({ url: '/merchant/update', method: 'PUT', data: { status: status } })
}

// 获取店铺统计数据
export function getShopStats() {
  return request({ url: '/merchant/stats', method: 'GET' })
}

// 获取工作台数据
export function getDashboard() {
  return request({ url: '/shop/dashboard', method: 'GET' })
}

// 商家分类列表（当前商家私有接口）
export function getMerchantCategoryList() {
  return request({ url: '/merchant/my-categories', method: 'GET' })
}

/** POST /api/merchant/category */
export function createCategory(data) {
  return request({ url: '/merchant/category', method: 'POST', data })
}

// 获取商品列表（旧接口，慎用：可能非本店维度）
export function getProductList(params = {}) {
  return request({ url: '/merchant/products', method: 'GET', data: params })
}

/** GET /api/merchant/my-products — 当前登录商家店铺下的商品 */
export function getMyProducts(params = {}) {
  return request({ url: '/merchant/my-products', method: 'GET', data: params })
}

// 创建商品
export function createProduct(data) {
  return request({ url: '/merchant/product/create', method: 'POST', data: data })
}

/** POST /api/merchant/product（与后端约定字段：name, price, category_id, description, images 等） */
export function createMerchantProduct(data) {
  return request({ url: '/merchant/product', method: 'POST', data })
}

// 更新商品
export function updateProduct(id, data) {
  return request({ url: '/merchant/product/' + id, method: 'PUT', data: data })
}

// 删除商品
export function deleteProduct(id) {
  return request({ url: '/merchant/product/' + id, method: 'DELETE' })
}

// 获取评价列表
export function getReviewList(params = {}) {
  return request({ url: '/merchant/reviews', method: 'GET', data: params })
}

// 获取财务统计
export function getFinanceStats(params = {}) {
  return request({ url: '/merchant/finance/stats', method: 'GET', data: params })
}