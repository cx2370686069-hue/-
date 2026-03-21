import { io } from 'socket.io-client'
import { BASE_URL } from '../config/index.js'

let socket = null

export function initSocket(token) {
  if (socket) {
    socket.disconnect()
  }
  
  socket = io(BASE_URL, {
    auth: { token: token },
    transports: ['websocket', 'polling']
  })
  
  socket.on('connect', () => {
    console.log('Socket 已连接')
  })
  
  socket.on('disconnect', () => {
    console.log('Socket 已断开')
  })
  
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

export function onNewDelivery(callback) {
  if (socket) {
    socket.on('new_delivery', callback)
  }
}

export function offAllListeners() {
  if (socket) {
    socket.removeAllListeners()
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  onNewDelivery,
  offAllListeners
}
