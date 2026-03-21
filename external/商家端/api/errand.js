import { get, post } from '@/utils/request.js'

export function publishErrand(data) {
  return post('/errand/publish', {
    '取件地址': data.pickupAddress,
    '收件地址': data.deliveryAddress,
    '物品类型': data.itemType,
    '期望送达时间': data.expectedTime,
    '悬赏金额': data.reward
  })
}

export function getErrandList() {
  return get('/errand/list')
}

export function acceptErrand(errandId) {
  return post('/errand/accept', { '订单ID': errandId })
}

export function completeErrand(errandId) {
  return post('/errand/complete', { '订单ID': errandId })
}
