import { get, post } from '@/utils/request.js'

export function getFoodList(category, sort, search) {
  let url = '/food/list'
  const params = []
  if (category) params.push('分类=' + encodeURIComponent(category))
  if (sort && sort !== '综合排序') params.push('排序=' + encodeURIComponent(sort))
  if (search) params.push('搜索=' + encodeURIComponent(search))
  if (params.length) url += '?' + params.join('&')
  return get(url)
}

export function searchFood(keyword) {
  return get('/food/list?搜索=' + encodeURIComponent(keyword))
}

export function getFoodDetail(id) {
  return get('/food/detail?商品ID=' + id)
}

export function getMyFoods() {
  return get('/food/my')
}

export function addFood(data) {
  return post('/food/add', {
    '商品名称': data.name,
    '价格': data.price,
    '分类': data.category,
    '库存': data.stock,
    '描述': data.desc
  })
}

export function updateFood(id, data) {
  return post('/food/update?商品ID=' + id, {
    '商品名称': data.name,
    '价格': data.price,
    '分类': data.category,
    '库存': data.stock,
    '描述': data.desc
  })
}

export function deleteFood(id) {
  return post('/food/delete?商品ID=' + id)
}
