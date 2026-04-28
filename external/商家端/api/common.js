import request from '../utils/request.js'

export function getTownServiceAreas() {
  return request({
    url: '/common/service-areas',
    method: 'GET',
    data: {
      area_type: 'town'
    }
  })
}

export function getMerchantPrimaryCategories() {
  return request({
    url: '/common/merchant-primary-categories',
    method: 'GET'
  })
}
