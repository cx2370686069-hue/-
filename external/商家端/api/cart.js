import request from '@/utils/request.js'

export function getCartList() {
  return request({ url: '/cart/list', method: 'GET' })
}

export function addToCart(foodId, quantity = 1) {
  return request({
    url: '/cart/add',
    method: 'POST',
    data: { foodId, quantity }
  })
}

export function removeFromCart(foodId) {
  return request({
    url: '/cart/remove',
    method: 'POST',
    data: { foodId }
  })
}

export function clearCart() {
  return request({ url: '/cart/clear', method: 'POST' })
}
