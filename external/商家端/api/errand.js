import request from '@/utils/request.js'

export function publishErrand(data) {
  return request({
    url: '/errand/publish',
    method: 'POST',
    data: {
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      itemType: data.itemType,
      expectedTime: data.expectedTime,
      reward: data.reward
    }
  })
}

export function getErrandList() {
  return request({ url: '/errand/list', method: 'GET' })
}

export function acceptErrand(errandId) {
  return request({
    url: '/errand/accept',
    method: 'POST',
    data: { errandId }
  })
}

export function completeErrand(errandId) {
  return request({
    url: '/errand/complete',
    method: 'POST',
    data: { errandId }
  })
}
