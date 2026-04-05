import request from '@/utils/request.js'

export function getFoodList(category, sort, search) {
  let url = '/food/list'
  const params = []
  if (category) params.push('category=' + encodeURIComponent(category))
  if (sort && sort !== '综合排序') params.push('sort=' + encodeURIComponent(sort))
  if (search) params.push('search=' + encodeURIComponent(search))
  if (params.length) url += '?' + params.join('&')
  return request({ url, method: 'GET' })
}

export function searchFood(keyword) {
  return request({ url: '/food/list?search=' + encodeURIComponent(keyword), method: 'GET' })
}

export function getFoodDetail(id) {
  return request({ url: '/food/detail?id=' + id, method: 'GET' })
}

export function getMyFoods() {
  return request({ url: '/food/my', method: 'GET' })
}

export function addFood(data) {
  return request({
    url: '/food/add',
    method: 'POST',
    data: {
      name: data.name,
      price: data.price,
      category: data.category,
      stock: data.stock,
      description: data.description,
      image: data.image,
      status: data.status
    }
  })
}

export function updateFood(id, data) {
  return request({
    url: '/food/update',
    method: 'POST',
    data: {
      id: id,
      name: data.name,
      price: data.price,
      category: data.category,
      stock: data.stock,
      description: data.description,
      image: data.image,
      status: data.status
    }
  })
}

export function deleteFood(id) {
  return request({ url: '/food/delete', method: 'POST', data: { id } })
}
