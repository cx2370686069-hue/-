// 连接到阿里云服务器
export const BASE_URL = 'http://121.43.190.218:3000'
// Socket.io 客户端应使用与服务同源的 HTTP(S) 地址
export const SOCKET_URL = 'http://121.43.190.218:3000'

/** 天地图开放平台「浏览器端」密钥（仅用于内嵌地图选点，勿用于服务端） https://console.tianditu.gov.cn/ */
export const TIANDITU_TK = '63a693ed968db6b7256470395e40fe5b'

export const ORDER_STATUS = {
  UNPAID: '待付款',
  WAITING: '待接单',
  COOKING: '备餐中',
  DELIVERING: '配送中',
  DONE: '已完成',
  CANCELLED: '已取消'
}

export const ORDER_STATUS_CLASS = {
  '待付款': 'status-unpaid',
  '待接单': 'status-waiting',
  '备餐中': 'status-cooking',
  '配送中': 'status-delivering',
  '已完成': 'status-done',
  '已取消': 'status-cancelled'
}

export const ROLE_MAP = {
  user: '普通用户',
  shop: '商家',
  rider: '骑手'
}

export const ROLE_EMOJI = {
  user: '😊',
  shop: '🏪',
  rider: '🛵'
}
