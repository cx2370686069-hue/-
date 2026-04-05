const { User } = require('../models');

let io = null;
const userSockets = new Map();
const merchantSockets = new Map();
const riderSockets = new Map();
const dispatcherSockets = new Map(); // 调度中心连接池 
const riderLastSeen = new Map(); // 看门狗：记录骑手最后上报GPS的时间 
const riderLocations = new Map(); // 缓存骑手最新坐标 
const LOST_CONTACT_THRESHOLD = 30000; // 骑手失联判定阈值 (30秒) 

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

  io.use(async (socket, next) => {
    try {
      let userId = null;
      let userRole = null;
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          // 尝试验证真正的 JWT
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.userId || decoded.id;
          
          if (userId) {
            const user = await User.findByPk(userId);
            if (user) {
              userRole = user.role;
            }
          }
        } catch (err) {
          // token 无效（比如大屏的 mock_jwt_token_for_admin_123），忽略并继续降级解析
        }
      }

      const authRole = socket.handshake.auth?.role;
      const queryRole = socket.handshake.query?.role;
      const headerRole = socket.handshake.headers?.role;
      
      socket.userRole = userRole || (authRole || queryRole || headerRole || 'user').toString().toLowerCase();
      
      // 提取原始的用户ID
      let rawUserId = userId ||
        socket.handshake.auth?.userId ||
        socket.handshake.query?.userId ||
        socket.handshake.headers?.['x-user-id'] ||
        `${socket.userRole}_${socket.id}`;
        
      // 关键修复：强制转换 userId 为数字，如果包含字母(如 dispatcher_xxxx)，则默认为 1
      socket.userId = isNaN(Number(rawUserId)) ? 1 : Number(rawUserId);

      next();
    } catch (e) {
      next();
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
      riderLastSeen.set(socket.userId, Date.now()); // 初始化活跃时间
    } else if (socket.userRole === 'dispatcher' || socket.userRole.startsWith('dispatcher')) {
      dispatcherSockets.set(socket.userId, socket);
      socket.join('dispatcher');
      socket.join('dispatcher_room');

      // 【大屏刷新防丢失优化】当调度员连接时，主动将数据库里的活跃订单和骑手推给它
      setTimeout(async () => {
        try {
          const { Order, Merchant, User } = require('../models');
          const { Op } = require('sequelize');
          
          // 1. 推送活跃订单 (状态 1~5 代表未完成的活跃订单)
          const activeOrders = await Order.findAll({
            where: { status: { [Op.in]: [1, 2, 3, 4, 5] } },
            include: [{ model: Merchant, as: 'merchant' }]
          });
          
          if (activeOrders.length > 0) {
            const radarData = activeOrders.map(order => {
              const m = order.merchant || {};
              const lng = order.customer_lng ?? order.delivery_longitude ?? null;
              const lat = order.customer_lat ?? order.delivery_latitude ?? null;
              return {
                id: order.id,
                orderId: order.order_no,
                order_no: order.order_no,
                restaurant: m.name,
                customer_town: order.customer_town,
                status: order.dispatch_status || 'pending',
                type: order.order_type || 'takeout',
                merchant_lng: m.longitude ? Number(m.longitude) : null,
                merchant_lat: m.latitude ? Number(m.latitude) : null,
                customer_lng: lng ? Number(lng) : null,
                customer_lat: lat ? Number(lat) : null,
                position: (lng && lat) ? [Number(lng), Number(lat)] : null,
                delivery_address: order.delivery_address || ''
              };
            });
            
            socket.emit('orders_update', {
              type: 'orders_update',
              orders: radarData
            });
          }

          // 2. 推送活跃骑手坐标
          const activeRiders = await User.findAll({
            where: { 
              role: 'rider', 
              status: 1, 
              rider_status: 1,
              rider_longitude: { [Op.not]: null },
              rider_latitude: { [Op.not]: null }
            }
          });
          
          activeRiders.forEach(rider => {
            socket.emit('location_update', {
              type: 'location_update',
              vehicleId: String(rider.id),
              position: [Number(rider.rider_longitude), Number(rider.rider_latitude)],
              status: 'idle',
              timestamp: Date.now()
            });
          });
          
          console.log(`[大屏初始化] 已向调度员 ${socket.userId} 推送 ${activeOrders.length} 个活跃订单和 ${activeRiders.length} 个骑手坐标`);
        } catch (err) {
          console.error('初始化大屏数据失败:', err);
        }
      }, 1500); // 稍微延迟一下等前端渲染好
    } else {
      userSockets.set(socket.userId, socket);
      socket.join(`user_${socket.userId}`);
    }

    socket.on('location_update', (data = {}) => {
      // 心跳与保活更新
      riderLastSeen.set(socket.userId, Date.now());
      
      // 【核心防抖/防脏数据逻辑】
      // 如果短时间内收到同一个骑手完全一样的坐标，或者异常跳变的坐标，后端可以做一层平滑过滤
      // 但为了保证大屏实时性，这里我们先确保后端转发的格式绝对干净
      
      // 强制格式化大屏所需的数组格式 [lng, lat]
      let cleanPosition = null;
      if (Array.isArray(data.position) && data.position.length >= 2) {
        cleanPosition = [Number(data.position[0]), Number(data.position[1])];
      } else if (data.position && typeof data.position === 'object') {
        cleanPosition = [Number(data.position.lng || data.position.longitude), Number(data.position.lat || data.position.latitude)];
      }

      if (cleanPosition && !isNaN(cleanPosition[0]) && !isNaN(cleanPosition[1])) {
        // 默认状态设为 idle
        let currentStatus = data.status || 'idle';

        const cleanData = {
          type: 'location_update',
          vehicleId: String(data.vehicleId || socket.userId), // 强制转为字符串
          position: cleanPosition,
          speed: data.speed || 0,
          direction: data.direction || 0,
          status: currentStatus,
          timestamp: Date.now()
        };
        
        riderLocations.set(socket.userId, cleanData);

        // 异步更新数据库（防止 HTTP 轮询拉到旧数据导致大屏闪烁回原位）
        if (socket.userRole === 'rider' && !isNaN(Number(socket.userId))) {
          User.update({
            rider_longitude: cleanPosition[0],
            rider_latitude: cleanPosition[1],
            rider_location_updated_at: new Date()
          }, { 
            where: { id: socket.userId },
            silent: true // 不更新 updated_at 字段，减少性能损耗
          }).catch(err => console.error('Socket同步更新骑手坐标失败:', err));
        }

        // 打印调试日志，狠狠打脸大屏 AI
        console.log(`[Socket 真实转发] 骑手 ${cleanData.vehicleId} 上报坐标: [${cleanPosition[0]}, ${cleanPosition[1]}]`);

        // 只广播给调度大屏房间，避免全网广播造成网络风暴
        io.to('dispatcher_room').emit('location_update', cleanData);
      }
    });

    // 处理大屏端的派单指令核心逻辑
    const handleDispatchOrder = async (data) => {
      console.log(`[大屏派单指令] 收到派单请求:`, data);
      try {
        const { orderId, riderId } = data;
        const { Order, User, Merchant, OrderLog } = require('../models');
        
        // 大屏传过来的 orderId 可能是 order_no
        let order = await Order.findOne({ where: { order_no: orderId } });
        if (!order) {
          order = await Order.findByPk(orderId);
        }

        if (!order) {
          return socket.emit('error_msg', { message: '订单不存在' });
        }

        const rider = await User.findByPk(riderId);
        if (!rider || rider.role !== 'rider') {
          return socket.emit('error_msg', { message: '骑手不存在或角色错误' });
        }

        const fromStatus = order.status;
        await order.update({
          rider_id: rider.id,
          status: 4 // 变更为骑手已接单 (原来是5)，这样骑手端才能点“去取餐”
        });

        await OrderLog.create({
          order_id: order.id,
          operator_id: socket.userId || 1, // 调度员ID
          operator_type: 'dispatcher',
          action: '大屏派单',
          from_status: fromStatus,
          to_status: 4,
          remark: `调度员派单给骑手：${rider.nickname || rider.phone || rider.id}`
        });

        const refreshed = await Order.findByPk(order.id, {
          include: [
            { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
            { model: User, as: 'user', attributes: ['nickname', 'phone'] },
            { model: User, as: 'rider', attributes: ['nickname', 'phone'] }
          ]
        });

        // 核心：推送给指定骑手！
        console.log(`[大屏派单成功] 正在通知骑手 ${rider.id}`);
        notifyRiderNewOrder(rider.id, refreshed);
        
        // 通知用户
        notifyUserOrderUpdate(order.user_id, refreshed, '骑手已接单，正在配送中');

        // 回复大屏派单成功
        socket.emit('dispatch_success', { orderId: order.id, order_no: order.order_no, riderId: rider.id });

      } catch (err) {
        console.error('大屏派单处理失败:', err);
        socket.emit('error_msg', { message: '派单处理失败' });
      }
    };

    socket.on('dispatch_order', handleDispatchOrder);

    // 处理原生 WebSocket 的 message (因为大屏用的 ws.send)
    socket.on('message', async (rawMsg) => {
      try {
        const msgStr = rawMsg.toString();
        const data = JSON.parse(msgStr);
        if (data.type === 'dispatch_order') {
          // 转交给 dispatch_order 处理器
          await handleDispatchOrder(data);
        }
      } catch (err) {
        // 解析失败忽略
      }
    });

    // 处理大屏端发起的心跳 ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`用户断开: ${socket.userId}`);
      userSockets.delete(socket.userId);
      merchantSockets.delete(socket.userId);
      riderSockets.delete(socket.userId);
      dispatcherSockets.delete(socket.userId);
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
    merchantSockets.forEach((socket) => {
      socket.emit(event, data);
    });
  }
}

/**
 * 向所有骑手推送消息
 */
function emitToAllRiders(event, data) {
  if (io) {
    riderSockets.forEach((socket) => {
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
