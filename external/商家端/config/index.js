// 手机访问时改成电脑局域网 IP，如 'http://192.168.1.100:8000'
export const BASE_URL = 'http://192.168.1.4:3000'

export const CATEGORY_LIST = [
  { id: 1, name: '跑腿代购', emoji: '🏃', bgColor: '#FFF1F0' },
  { id: 2, name: '二手机买卖', emoji: '📱', bgColor: '#E6F4FF' },
  { id: 3, name: '数码配件', emoji: '🎧', bgColor: '#E6F4FF' },
  { id: 4, name: '五金工具', emoji: '🛠️', bgColor: '#FFF7E6' },
  { id: 5, name: '代取快递', emoji: '📦', bgColor: '#E6F7FF' },
  { id: 6, name: '附近超市', emoji: '🏪', bgColor: '#F0F5FF' },
  { id: 7, name: '家电维修', emoji: '🔧', bgColor: '#FFFBE6' },
  { id: 8, name: '顺路带货', emoji: '🚚', bgColor: '#F3E8FF' }
]

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

export const PAY_METHODS = [
  { id: 'wechat', name: '微信支付', desc: '推荐使用', icon: '💚' },
  { id: 'alipay', name: '支付宝', desc: '支付宝快捷支付', icon: '💙' },
  { id: 'balance', name: '余额支付', desc: '账户余额支付', icon: '💰' }
]

export const PAY_METHOD_NAMES = {
  wechat: '微信支付',
  alipay: '支付宝',
  balance: '余额支付'
}

export const HOT_SEARCH = ['奶茶', '炸鸡', '米饭', '拉面', '烧烤', '蛋糕', '早餐']
