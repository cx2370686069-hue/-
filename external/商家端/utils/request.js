/**
 * 网络请求封装
 */

import { BASE_URL } from '../config/index.js';

const API_BASE_URL = BASE_URL + '/api';

function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || '';
    
    // 严格按照规范设置 header
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    };
    
    if (token) {
      header['Authorization'] = 'Bearer ' + token;
    }

    let requestUrl = options.url || ''
    if (requestUrl === '/order/list' || requestUrl === '/order/merchant/list') {
      requestUrl = '/order/my'
    }

    uni.request({
      url: API_BASE_URL + requestUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          uni.showToast({ title: '接口无权限或未实现', icon: 'none' });
          reject(res.data);
          return;
        }
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          let msg = res.data.detail || res.data.message || res.data.msg || '请求失败';
          
          if (res.statusCode >= 500 || (typeof msg === 'string' && /Field|SQL|doesn't have a default value|Duplicate entry/i.test(msg))) {
            msg = '系统繁忙，请稍后再试';
          }
          
          // 临时屏蔽“您还没有店铺”的弹窗报错，防止阻塞联调
          if (msg !== '您还没有店铺') {
            uni.showToast({ title: msg, icon: 'none' });
          }
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
