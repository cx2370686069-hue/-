const jwt = require('jsonwebtoken');

let io = null;
const userSockets = new Map();
const merchantSockets = new Map();
const riderSockets = new Map();

/**
 * 初始化 Socket.io
 */
function init(server) {
  io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.userId} (${socket.userRole})`);

    if (socket.userRole === 'merchant') {
      merchantSockets.set(socket.userId, socket);
      socket.join(`merchant_${socket.userId}`);
    } else if (socket.userRole === 'rider') {
      riderSockets.set(socket.userId, socket);
      socket.join(`rider_${socket.userId}`);
    } else {
      userSockets.set(socket.userId, socket);
      socket.join(`user_${socket.userId}`);
    }

    socket.on('disconnect', () => {
      console.log(`用户断开: ${socket.userId}`);
      userSockets.delete(socket.userId);
      merchantSockets.delete(socket.userId);
      riderSockets.delete(socket.userId);
    });

    socket.on('join_room', (room) => {
      socket.join(room);
    });
  });

  console.log('✅ Socket.io 初始化完成');
  return io;
}

/**
 * 获取 io 实例
 */
function getIO() {
  return io;
}

/**
 * 向指定用户推送消息
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

/**
 * 向指定商家推送消息
 */
function emitToMerchant(userId, event, data) {
  if (io) {
    io.to(`merchant_${userId}`).emit(event, data);
  }
}

/**
 * 向指定骑手推送消息
 */
function emitToRider(userId, event, data) {
  if (io) {
    io.to(`rider_${userId}`).emit(event, data);
  }
}

/**
 * 向所有商家推送消息
 */
function emitToAllMerchants(event, data) {
  if (io) {
    merchantSockets.forEach((socket, userId) => {
      socket.emit(event, data);
    });
  }
}

/**
 * 向所有骑手推送消息
 */
function emitToAllRiders(event, data) {
  if (io) {
    riderSockets.forEach((socket, userId) => {
      socket.emit(event, data);
    });
  }
}

/**
 * 推送新订单通知给商家
 */
function notifyMerchantNewOrder(merchantUserId, order) {
  emitToMerchant(merchantUserId, 'new_order', {
    type: 'new_order',
    title: '新订单',
    message: `您有一个新订单，订单号: ${order.order_no}`,
    data: order,
    timestamp: new Date()
  });
}

/**
 * 推送订单状态更新给用户
 */
function notifyUserOrderUpdate(userId, order, statusText) {
  emitToUser(userId, 'order_update', {
    type: 'order_update',
    title: '订单状态更新',
    message: `您的订单${statusText}`,
    data: order,
    timestamp: new Date()
  });
}

/**
 * 推送派单通知给骑手
 */
function notifyRiderNewOrder(riderUserId, order) {
  emitToRider(riderUserId, 'new_delivery', {
    type: 'new_delivery',
    title: '新配送任务',
    message: `您有一个新的配送任务`,
    data: order,
    timestamp: new Date()
  });
}

module.exports = {
  init,
  getIO,
  emitToUser,
  emitToMerchant,
  emitToRider,
  emitToAllMerchants,
  emitToAllRiders,
  notifyMerchantNewOrder,
  notifyUserOrderUpdate,
  notifyRiderNewOrder
};
