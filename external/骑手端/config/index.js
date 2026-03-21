/**
 * 全局配置
 */
export const BASE_URL = 'http://192.168.1.4:3000'

// 骑手端配置
export const RIDER = {
  STATUS_OFFLINE: 0,  // 休息
  STATUS_ONLINE: 1    // 接单中
}

// 订单状态
export const ORDER_STATUS = {
  0: { text: '待支付', color: '#FF6B35' },
  1: { text: '待接单', color: '#1890FF' },
  2: { text: '已接单', color: '#FAAD14' },
  3: { text: '备货中', color: '#FAAD14' },
  4: { text: '备货完成', color: '#2F54EB' },
  5: { text: '配送中', color: '#52C41A' },
  6: { text: '已完成', color: '#52C41A' },
  7: { text: '已取消', color: '#999' }
}

// 跑腿订单状态
export const ERRAND_STATUS = {
  0: { text: '待支付', color: '#FF6B35' },
  1: { text: '待接单', color: '#1890FF' },
  5: { text: '配送中', color: '#52C41A' },
  6: { text: '已完成', color: '#52C41A' },
  7: { text: '已取消', color: '#999' }
}

export default {
  BASE_URL,
  RIDER,
  ORDER_STATUS,
  ERRAND_STATUS
}
