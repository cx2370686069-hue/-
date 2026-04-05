import request from '@/utils/request.js'

export function getAddressList() {
  return request({ url: '/address/list', method: 'GET' })
}

export function addAddress(data) {
  return request({
    url: '/address/add',
    method: 'POST',
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      isDefault: data.isDefault ? 1 : 0
    }
  })
}

export function updateAddress(id, data) {
  return request({
    url: '/address/update',
    method: 'POST',
    data: {
      id,
      name: data.name,
      phone: data.phone,
      address: data.address,
      isDefault: data.isDefault ? 1 : 0
    }
  })
}

export function deleteAddress(id) {
  return request({
    url: '/address/delete',
    method: 'POST',
    data: { id }
  })
}

export function setDefaultAddress(id) {
  return request({
    url: '/address/setDefault',
    method: 'POST',
    data: { id }
  })
}
