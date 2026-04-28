/**
 * 全局配置
 */
export const BASE_URL = 'http://121.43.190.218:3000'

export const TIANDITU_TK = '63a693ed968db6b7256470395e40fe5b'

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

/**
 * 是否显示「确认送达」按钮：骑手已接单后的阶段（2～5）。
 * 与 canRiderCallConfirmDeliveryApi 分离：仅 status=5 时才会真正请求 confirm-delivery。
 */
export function canRiderShowConfirmDelivery(status) {
  const s = Number(status)
  return s >= 2 && s <= 5
}

/** 后端允许调用 POST /api/order/confirm-delivery 的订单状态（配送中） */
export function canRiderCallConfirmDeliveryApi(status) {
  return Number(status) === 5
}

/** 是否可走「特殊完结」：已接单～备货完成(2～4)，非标准配送中 */
export function canRiderOfferSpecialComplete(status) {
  const s = Number(status)
  return s >= 2 && s <= 4
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
  TIANDITU_TK,
  RIDER,
  ORDER_STATUS,
  canRiderShowConfirmDelivery,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete,
  ERRAND_STATUS
}
