const fs = require('fs');

console.log('========================================');
console.log('   用户端和商家端API修复');
console.log('========================================\n');

// 用户端 api/user.js 内容
const userUserApi = `import { post, get, put } from '../utils/request.js'

/**
 * 用户模块接口
 */

/**
 * 用户注册
 */
export function register(data) {
  return post('/auth/register', {
    phone: data.phone,
    password: data.password,
    nickname: data.nickname,
    role: data.role || 'user'
  })
}

/**
 * 用户登录
 */
export function login(data) {
  return post('/auth/login', {
    phone: data.phone,
    password: data.password
  })
}

/**
 * 获取当前用户信息
 */
export function getUserInfo() {
  return get('/auth/me')
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  return put('/auth/profile', {
    nickname: data.nickname,
    avatar: data.avatar
  })
}
`;

// 用户端 api/food.js 内容
const userFoodApi = `import { get, post, put, del } from '../utils/request.js'

/**
 * 商品模块接口
 */

/**
 * 获取商品列表（用户端浏览）
 */
export function getFoodList(category, sort, search) {
  let url = '/merchant/products'
  const params = []
  if (category) params.push('category=' + encodeURIComponent(category))
  if (sort && sort !== '综合排序') params.push('sort=' + encodeURIComponent(sort))
  if (search) params.push('search=' + encodeURIComponent(search))
  if (params.length) url += '?' + params.join('&')
  return get(url)
}

/**
 * 搜索商品
 */
export function searchFood(keyword) {
  return get('/merchant/products?search=' + encodeURIComponent(keyword))
}

/**
 * 获取商品详情
 */
export function getFoodDetail(id) {
  return get('/merchant/product/' + id)
}

/**
 * 获取商家列表
 */
export function getMerchantList(params = {}) {
  return get('/merchant/list', params)
}

/**
 * 获取商家详情
 */
export function getMerchantDetail(id) {
  return get('/merchant/detail/' + id)
}

/**
 * 获取商家商品列表
 */
export function getMerchantProducts(merchantId) {
  return get('/merchant/' + merchantId + '/products')
}
`;

// 商家端 api/user.js 内容
const merchantUserApi = `import { post, get, put } from '../utils/request.js'

/**
 * 用户认证接口（商家端）
 */

/**
 * 商家注册
 */
export function register(data) {
  return post('/auth/register', {
    phone: data.phone,
    password: data.password,
    nickname: data.nickname,
    role: 'merchant'
  })
}

/**
 * 商家登录
 */
export function login(data) {
  return post('/auth/login', {
    phone: data.phone,
    password: data.password
  })
}

/**
 * 获取当前用户信息
 */
export function getUserInfo() {
  return get('/auth/me')
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  return put('/auth/profile', {
    nickname: data.nickname,
    avatar: data.avatar
  })
}
`;

// 修复用户端 user.js
console.log('[1/3] 正在修复用户端 api/user.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖前端\\api\\user.js', userUserApi, 'utf8');
  console.log('    √ 用户端 user.js 修复成功！');
} catch (err) {
  console.log('    × 用户端 user.js 修复失败:', err.message);
}

console.log('');

// 修复用户端 food.js
console.log('[2/3] 正在修复用户端 api/food.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖前端\\api\\food.js', userFoodApi, 'utf8');
  console.log('    √ 用户端 food.js 修复成功！');
} catch (err) {
  console.log('    × 用户端 food.js 修复失败:', err.message);
}

console.log('');

// 修复商家端 user.js
console.log('[3/3] 正在修复商家端 api/user.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖商家端\\api\\user.js', merchantUserApi, 'utf8');
  console.log('    √ 商家端 user.js 修复成功！');
} catch (err) {
  console.log('    × 商家端 user.js 修复失败:', err.message);
}

console.log('');
console.log('========================================');
console.log('   修复完成！');
console.log('========================================');
console.log('');
console.log('修复内容：');
console.log('  1. 用户端 user.js：去掉路径中的 /api 前缀');
console.log('  2. 用户端 food.js：去掉路径中的 /api 前缀');
console.log('  3. 商家端 user.js：中文参数改英文 + 路径修正');
