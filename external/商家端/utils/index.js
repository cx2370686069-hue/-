/**
 * 工具函数
 */

// 格式化金额
export function formatMoney(num) {
  if (num === undefined || num === null) return '0.00';
  return Number(num).toFixed(2);
}

// 格式化时间
export function formatTime(timestamp, format = 'YYYY-MM-DD HH:mm') {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

// 订单状态映射
export const ORDER_STATUS = {
  0: { text: '待接单', color: '#FF6B35' },
  1: { text: '已接单', color: '#1890ff' },
  2: { text: '制作中', color: '#1890ff' },
  3: { text: '待配送', color: '#faad14' },
  4: { text: '配送中', color: '#1890ff' },
  5: { text: '已完成', color: '#52c41a' },
  6: { text: '已取消', color: '#999' }
};
