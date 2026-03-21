import { get, post } from '@/utils/request.js'

export function getAddressList() {
  return get('/address/list')
}

export function addAddress(data) {
  return post('/address/add', {
    '收货人': data.name,
    '联系电话': data.phone,
    '详细地址': data.address,
    '是否默认': data.isDefault ? 1 : 0
  })
}

export function updateAddress(id, data) {
  return post('/address/update?地址ID=' + id, {
    '收货人': data.name,
    '联系电话': data.phone,
    '详细地址': data.address,
    '是否默认': data.isDefault ? 1 : 0
  })
}

export function deleteAddress(id) {
  return post('/address/delete?地址ID=' + id)
}

export function setDefaultAddress(id) {
  return post('/address/setDefault?地址ID=' + id)
}
