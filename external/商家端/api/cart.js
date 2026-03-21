import { get, post } from '@/utils/request.js'

export function getCartList() {
  return get('/cart/list')
}

export function addToCart(foodId, quantity = 1) {
  return post('/cart/add', { '商品ID': foodId, '数量': quantity })
}

export function removeFromCart(foodId) {
  return post('/cart/remove', { '商品ID': foodId })
}

export function clearCart() {
  return post('/cart/clear')
}
