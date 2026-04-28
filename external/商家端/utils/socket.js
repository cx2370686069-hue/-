import { io } from 'socket.io-client'
import { SOCKET_URL } from '../config/index.js'
import { playMerchantNewOrderNotify } from './merchant-notify.js'

let socket = null
const newOrderCallbacks = []
const orderUpdateCallbacks = []
const newDeliveryCallbacks = []

function bindSocketListeners() {
  if (!socket) return
  socket.on('connect', () => {
    console.log('[socket] connected', socket.id)
  })
  socket.on('connect_error', (err) => {
    console.log('[socket] connect_error', JSON.stringify({
      message: err?.message,
      description: err?.description,
      type: err?.type
    }))
  })
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnect', reason)
  })
  socket.on('new_order', (data) => {
    console.log('[socket] new_order received', data)
    try {
      const played = playMerchantNewOrderNotify()
      console.log('[socket] new_order notify played =', played)
    } catch (e) {
      console.error('[socket] playMerchantNewOrderNotify', e)
    }
    try {
      uni.showToast({ title: '您有新的外卖订单！', icon: 'none' })
    } catch (e) {}
    try {
      uni.$emit('merchant_new_order', data)
    } catch (e) {
      console.error('[socket] merchant_new_order emit failed', e)
    }
    newOrderCallbacks.forEach((cb) => {
      try {
        cb(data)
      } catch (e) {
        console.error('new_order 回调异常', e)
      }
    })
  })
  socket.on('order_update', (data) => {
    orderUpdateCallbacks.forEach((cb) => {
      try {
        cb(data)
      } catch (e) {
        console.error('order_update 回调异常', e)
      }
    })
  })
  socket.on('new_delivery', (data) => {
    newDeliveryCallbacks.forEach((cb) => {
      try {
        cb(data)
      } catch (e) {
        console.error('new_delivery 回调异常', e)
      }
    })
  })
}

export function initSocket(token, userId) {
  if (!token) {
    console.log('[socket] init skipped: missing token')
    return null
  }
  if (socket) {
    socket.disconnect()
    socket = null
  }

  const tokenStr = typeof token === 'string' ? token : ''
  const bearer = tokenStr.startsWith('Bearer ') ? tokenStr : 'Bearer ' + tokenStr
  console.log('[socket] initSocket', {
    socketUrl: SOCKET_URL,
    role: 'merchant',
    userId: String(userId || '')
  })

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 60000,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // 仅传 token，避免后端握手校验不通过（多余字段可能导致进不了商家房间）
    auth: {
      token: bearer
    },
    query: {
      role: 'merchant',
      userId: String(userId || '')
    }
  })

  bindSocketListeners()
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** 注册新订单监听（可先注册再 initSocket；支持多页面同时监听） */
export function onNewOrder(callback) {
  if (typeof callback !== 'function') return
  if (!newOrderCallbacks.includes(callback)) {
    newOrderCallbacks.push(callback)
  }
}

export function offNewOrder(callback) {
  const i = newOrderCallbacks.indexOf(callback)
  if (i !== -1) newOrderCallbacks.splice(i, 1)
}

export function onOrderUpdate(callback) {
  if (typeof callback !== 'function') return
  if (!orderUpdateCallbacks.includes(callback)) {
    orderUpdateCallbacks.push(callback)
  }
}

export function onNewDelivery(callback) {
  if (typeof callback !== 'function') return
  if (!newDeliveryCallbacks.includes(callback)) {
    newDeliveryCallbacks.push(callback)
  }
}

export function offAllListeners() {
  newOrderCallbacks.length = 0
  orderUpdateCallbacks.length = 0
  newDeliveryCallbacks.length = 0
  if (socket) {
    socket.removeAllListeners()
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  onNewOrder,
  offNewOrder,
  onOrderUpdate,
  onNewDelivery,
  offAllListeners
}
