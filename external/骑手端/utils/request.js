/**
 * 网络请求封装
 * - 自动携带 token
 * - 统一错误处理
 * - 统一响应格式
 */

import { BASE_URL } from '../config/index.js'

const API_BASE_URL = BASE_URL + '/api'

/**
 * 发起请求
 * @param {string} url - 接口路径
 * @param {string} method - 请求方法
 * @param {object} data - 请求数据
 */
function request({ url, method = 'GET', data = {} }) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || ''
    
    uni.request({
      url: API_BASE_URL + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        // 401 未登录
        if (res.statusCode === 401) {
          uni.removeStorageSync('token')
          uni.removeStorageSync('userInfo')
          uni.reLaunch({ url: '/pages/login/index' })
          reject({ code: 401, msg: '请先登录' })
          return
        }
        
        // 成功
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          // 失败
          const msg = res.data?.msg || res.data?.message || res.data?.detail || '请求失败'
          uni.showToast({ title: msg, icon: 'none', duration: 2000 })
          reject({ code: res.statusCode, msg: msg })
        }
      },
      fail: (err) => {
        console.error('网络请求失败:', err)
        uni.showToast({ 
          title: '网络错误，请检查网络', 
          icon: 'none',
          duration: 2000
        })
        reject({ code: 500, msg: '网络错误' })
      }
    })
  })
}

// 快捷方法
export function get(url, data) {
  return request({ url, method: 'GET', data })
}

export function post(url, data) {
  return request({ url, method: 'POST', data })
}

export function put(url, data) {
  return request({ url, method: 'PUT', data })
}

export function del(url, data) {
  return request({ url, method: 'DELETE', data })
}

export default request
