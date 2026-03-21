/**
 * 工具函数
 */

/**
 * 格式化时间
 * @param {number|string} time - 时间戳或日期字符串
 * @param {string} format - 格式
 */
export function formatTime(time, format = 'YYYY-MM-DD HH:mm') {
  if (!time) return ''
  
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 格式化金额
 * @param {number} amount - 金额
 */
export function formatMoney(amount) {
  if (!amount && amount !== 0) return '0.00'
  return Number(amount).toFixed(2)
}

/**
 * 计算距离（简化版，实际项目需要用地图 SDK）
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  // 简化计算，实际应该用地图 SDK
  return Math.random().toFixed(1) + 'km'
}

/**
 * 防抖函数
 */
export function debounce(fn, delay = 300) {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 */
export function throttle(fn, delay = 500) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn.apply(this, args)
      lastTime = now
    }
  }
}
