const fs = require('fs');

console.log('========================================');
console.log('   商家端API接口补充修复');
console.log('========================================\n');

// 商家端 api/shop.js 内容
const merchantShopApi = `import request from '../utils/request.js'

/**
 * 店铺模块接口（商家端）
 */

// 获取当前商家店铺信息
export function getShopInfo() {
  return request({ url: '/merchant/my', method: 'GET' })
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
  return request({ url: '/merchant/dashboard', method: 'GET' })
}

// 获取商品列表
export function getProductList(params = {}) {
  return request({ url: '/merchant/products', method: 'GET', data: params })
}

// 创建商品
export function createProduct(data) {
  return request({ url: '/merchant/product', method: 'POST', data: data })
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
`;

// 修复商家端 shop.js
console.log('[1/1] 正在修复商家端 api/shop.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖商家端\\api\\shop.js', merchantShopApi, 'utf8');
  console.log('    √ 商家端 shop.js 修复成功！');
} catch (err) {
  console.log('    × 商家端 shop.js 修复失败:', err.message);
}

console.log('');
console.log('========================================');
console.log('   修复完成！');
console.log('========================================');
