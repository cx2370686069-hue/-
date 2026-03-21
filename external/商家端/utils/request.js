/**
 * 网络请求封装
 */

import { BASE_URL } from '../config/index.js';

const API_BASE_URL = BASE_URL + '/api';

function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || '';

    uni.request({
      url: API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? "Bearer " + token : ''
      },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: '未登录，部分数据为演示', icon: 'none' });
          reject(res.data);
          return;
        }
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          const msg = res.data.detail || res.data.message || res.data.msg || '请求失败';
          uni.showToast({ title: msg, icon: 'none' });
          reject(res.data);
        }
      },
      fail: () => {
        uni.showToast({ title: '网络错误，请检查后端是否启动', icon: 'none' });
        reject({ message: '网络错误' });
      }
    });
  });
}

export default request;
