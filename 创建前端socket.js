const fs = require('fs');

console.log('========================================');
console.log('   前端 Socket.io 工具创建');
console.log('========================================\n');

// 用户端和商家端 socket 工具
const socketUtils = `import { io } from 'socket.io-client'
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
  
  socket.on('connect_error', (err) => {
    console.log('Socket 连接错误:', err.message)
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

export function onNewOrder(callback) {
  if (socket) {
    socket.on('new_order', callback)
  }
}

export function onOrderUpdate(callback) {
  if (socket) {
    socket.on('order_update', callback)
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
  onNewOrder,
  onOrderUpdate,
  onNewDelivery,
  offAllListeners
}
`;

// 骑手端 socket 工具
const riderSocketUtils = `import { io } from 'socket.io-client'
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
`;

console.log('[1/3] 正在创建用户端 utils/socket.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖前端\\utils\\socket.js', socketUtils, 'utf8');
  console.log('    √ 用户端 socket.js 创建成功！');
} catch (err) {
  console.log('    × 用户端 socket.js 创建失败:', err.message);
}

console.log('');

console.log('[2/3] 正在创建商家端 utils/socket.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖商家端\\utils\\socket.js', socketUtils, 'utf8');
  console.log('    √ 商家端 socket.js 创建成功！');
} catch (err) {
  console.log('    × 商家端 socket.js 创建失败:', err.message);
}

console.log('');

console.log('[3/3] 正在创建骑手端 utils/socket.js ...');
try {
  fs.writeFileSync('E:\\固始县外卖骑手端\\utils\\socket.js', riderSocketUtils, 'utf8');
  console.log('    √ 骑手端 socket.js 创建成功！');
} catch (err) {
  console.log('    × 骑手端 socket.js 创建失败:', err.message);
}

console.log('');
console.log('========================================');
console.log('   创建完成！');
console.log('========================================');
console.log('');
console.log('注意：前端需要安装 socket.io-client');
console.log('在各个前端目录运行: npm install socket.io-client');
