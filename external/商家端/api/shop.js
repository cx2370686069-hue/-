import request from '../utils/request.js'
import { BASE_URL } from '../config/index.js'

/**
 * 店铺模块接口（商家端）
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

function buildShopPayload(data) {
  const body = { ...data }
  const coordinatePair = getValidCoordinatePair(body.latitude, body.longitude)
  if (!coordinatePair) {
    throw new Error('地图坐标无效，请重新选点后再提交')
  }
  body.latitude = coordinatePair.latitude
  body.longitude = coordinatePair.longitude
  return body
}

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
  return request({ url: '/merchant/create', method: 'POST', data: buildShopPayload(data) })
}

// 更新店铺信息
export function updateShopInfo(data) {
  return request({ url: '/merchant/update', method: 'PUT', data: buildShopPayload(data) })
}

// 上传店铺图片（头像/封面）
export function uploadShopImage(filePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || ''
    const header = token ? { Authorization: 'Bearer ' + token } : {}

    uni.uploadFile({
      url: BASE_URL + '/api/upload/image',
      filePath,
      name: 'file',
      header,
      success: (res) => {
        let data = null
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (e) {
          reject(new Error('上传响应解析失败'))
          return
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && data && (data.code === 200 || data.success) && data.data && data.data.url) {
          resolve(data)
          return
        }

        const message = data && (data.detail || data.message || data.msg) ? (data.detail || data.message || data.msg) : '上传失败'
        reject(new Error(message))
      },
      fail: () => {
        reject(new Error('上传失败，请检查网络'))
      }
    })
  })
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

/** PUT /api/merchant/category/:id */
export function updateCategory(id, data) {
  return request({ url: '/merchant/category/' + id, method: 'PUT', data })
}

/** DELETE /api/merchant/category/:id */
export function deleteCategory(id) {
  return request({ url: '/merchant/category/' + id, method: 'DELETE' })
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
