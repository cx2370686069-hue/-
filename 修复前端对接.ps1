# 前后端对接修复脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   前后端对接修复脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 用户端 request.js 内容
$userRequestJs = @'
/**
 * 统一请求封装
 * - 自动带上 token
 * - 统一错误处理
 * - 后端地址集中配置
 */

import { BASE_URL } from '../config/index.js'

const API_BASE_URL = BASE_URL + '/api'

export function request(url, method = "GET", data = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync("token") || ""

    uni.request({
      url: API_BASE_URL + url,
      method: method,
      data: data,
      header: {
        "Content-Type": "application/json",
        "Authorization": token ? "Bearer " + token : ""
      },
      success: (res) => {
        if (res.statusCode === 401) {
          uni.showToast({ title: "请先登录", icon: "none" })
          setTimeout(() => {
            uni.navigateTo({ url: "/pages/login/index" })
          }, 1000)
          reject({ code: 401, msg: "请先登录" })
          return
        }
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          const msg = res.data.msg || res.data.message || res.data.detail || "请求失败"
          uni.showToast({ title: msg, icon: "none" })
          reject({ code: res.statusCode, msg: msg })
        }
      },
      fail: (err) => {
        uni.showToast({ title: "网络错误，请检查后端是否启动", icon: "none" })
        reject({ code: 500, msg: "网络错误" })
      }
    })
  })
}

export function get(url) {
  return request(url, "GET")
}

export function post(url, data) {
  return request(url, "POST", data)
}

export function put(url, data) {
  return request(url, "PUT", data)
}

export function del(url, data) {
  return request(url, "DELETE", data)
}
'@

# 商家端 request.js 内容
$merchantRequestJs = @'
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
'@

# 修复用户端
Write-Host "[1/2] 正在修复用户端 request.js ..." -ForegroundColor Yellow
try {
    $userRequestJs | Out-File -FilePath "E:\固始县外卖前端\utils\request.js" -Encoding UTF8 -Force
    Write-Host "    √ 用户端修复成功！" -ForegroundColor Green
} catch {
    Write-Host "    × 用户端修复失败: $_" -ForegroundColor Red
}

Write-Host ""

# 修复商家端
Write-Host "[2/2] 正在修复商家端 request.js ..." -ForegroundColor Yellow
try {
    $merchantRequestJs | Out-File -FilePath "E:\固始县外卖商家端\utils\request.js" -Encoding UTF8 -Force
    Write-Host "    √ 商家端修复成功！" -ForegroundColor Green
} catch {
    Write-Host "    × 商家端修复失败: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   修复完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "修复内容：" -ForegroundColor White
Write-Host "  1. 用户端：统一BASE_URL配置 + 添加/api前缀" -ForegroundColor White
Write-Host "  2. 商家端：修正认证头格式为 Bearer token" -ForegroundColor White
Write-Host ""
Write-Host "骑手端无需修改，配置已正确。" -ForegroundColor Green
Write-Host ""
