const jwt = require('jsonwebtoken');
const { User, Order, Merchant } = require('../models');

let io = null;
const userSockets = new Map();
const merchantSockets = new Map();
const riderSockets = new Map();
const dispatcherSockets = new Map(); // 调度中心连接池 
const riderLastSeen = new Map(); // 看门狗：记录骑手最后上报GPS的时间 
const riderLocations = new Map(); // 缓存骑手最新坐标 
const LOST_CONTACT_THRESHOLD = 30000; // 骑手失联判定阈值 (30秒) 

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

async function resolveSocketIdentity(socket) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Unauthorized');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Unauthorized');
  }

  const rawUserId = decoded.userId || decoded.id;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Unauthorized');
  }

  const user = await User.findByPk(userId, {
    attributes: ['id', 'role', 'status']
  });
  if (!user || Number(user.status) !== 1) {
    throw new Error('Unauthorized');
  }

  const dbRole = String(user.role || '').toLowerCase();
  let socketRole = dbRole;
  if (dbRole === 'admin') {
    socketRole = 'dispatcher';
  }

  if (!['user', 'merchant', 'rider', 'dispatcher'].includes(socketRole)) {
    throw new Error('Unauthorized');
  }

  return {
    userId: user.id,
    userRole: socketRole,
    accountRole: dbRole
  };
}

function buildDispatcherRadarOrder(order) {
  const merchant = order.merchant || {};
  const customerLng = toFiniteNumber(order.customer_lng ?? order.delivery_longitude);
  const customerLat = toFiniteNumber(order.customer_lat ?? order.delivery_latitude);
  const merchantLng = toFiniteNumber(order.merchant_lng ?? merchant.longitude);
  const merchantLat = toFiniteNumber(order.merchant_lat ?? merchant.latitude);

  return {
    id: order.order_no,
    order_id: order.id,
    order_no: order.order_no,
    rider_id: order.rider_id || null,
    lng: customerLng,
    lat: customerLat,
    position: customerLng !== null && customerLat !== null ? [customerLng, customerLat] : null,
    customer_lng: customerLng,
    customer_lat: customerLat,
    customer_position: customerLng !== null && customerLat !== null ? [customerLng, customerLat] : null,
    merchant_lng: merchantLng,
    merchant_lat: merchantLat,
    merchant_position: merchantLng !== null && merchantLat !== null ? [merchantLng, merchantLat] : null,
    merchant_name: merchant.name || '',
    restaurant: merchant.name || '',
    customer_town: order.customer_town,
    status: order.dispatch_status || 'pending',
    type: order.order_type === 'county' ? 'county' : 'town',
    color: order.order_type === 'county' ? 'blue' : 'red',
    products_info: order.products_info,
    delivery_address: order.delivery_address || '',
    address: order.address || order.delivery_address || ''
  };
}

async function getDispatcherOrdersSnapshot() {
  const { Op } = require('sequelize');
  const activeOrders = await Order.findAll({
    where: { status: { [Op.in]: [0, 1, 2, 3, 4, 5] } },
    include: [{ model: Merchant, as: 'merchant' }],
    order: [['id', 'DESC']]
  });

  return activeOrders.map(buildDispatcherRadarOrder);
}

async function broadcastDispatcherOrdersUpdate(targetSocket = null) {
  if (!io && !targetSocket) {
    return;
  }

  try {
    const orders = await getDispatcherOrdersSnapshot();
    const payload = {
      type: 'orders_update',
      orders
    };

    if (targetSocket) {
      targetSocket.emit('orders_update', payload);
      return;
    }

    io.to('dispatcher_room').emit('orders_update', payload);
  } catch (error) {
    console.error('推送调度台订单地图快照失败:', error);
  }
}

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
      const identity = await resolveSocketIdentity(socket);
      socket.userId = identity.userId;
      socket.userRole = identity.userRole;
      socket.accountRole = identity.accountRole;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
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
    } else if (socket.userRole === 'dispatcher') {
      dispatcherSockets.set(socket.userId, socket);
      socket.join('dispatcher');
      socket.join('dispatcher_room');

      // 【大屏刷新防丢失优化】当调度员连接时，主动将数据库里的活跃订单和骑手推给它
      setTimeout(async () => {
        try {
          await broadcastDispatcherOrdersUpdate(socket);

          const { Op } = require('sequelize');
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
          
          const activeOrders = await getDispatcherOrdersSnapshot();
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
      if (socket.userRole !== 'rider') {
        return;
      }

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
      if (socket.userRole !== 'dispatcher') {
        return socket.emit('error_msg', { message: '无权派单' });
      }

      console.log(`[大屏派单指令] 收到派单请求:`, data);
      try {
        const { orderId, riderId } = data;
        if (!orderId || !riderId) {
          return socket.emit('error_msg', { message: '派单参数不完整' });
        }

        const { Order, User, Merchant, OrderLog, sequelize } = require('../models');

        const dispatchResult = await sequelize.transaction(async (transaction) => {
          // 大屏传过来的 orderId 可能是 order_no
          let order = await Order.findOne({
            where: { order_no: orderId },
            transaction,
            lock: transaction.LOCK.UPDATE
          });
          if (!order) {
            order = await Order.findByPk(orderId, {
              transaction,
              lock: transaction.LOCK.UPDATE
            });
          }

          if (!order) {
            return { error: '订单不存在' };
          }

          if (order.type !== 'takeout' || order.order_type !== 'county') {
            return { error: '当前订单不支持大屏派单，请走对应业务链路' };
          }

          const rider = await User.findByPk(riderId, { transaction });
          if (!rider || rider.role !== 'rider') {
            return { error: '骑手不存在或角色错误' };
          }

          const fromStatus = Number(order.status);
          if (![3, 4].includes(fromStatus)) {
            return { error: '当前订单状态不允许派单' };
          }

          const currentRiderId = Number(order.rider_id || 0) || null;
          if (currentRiderId && currentRiderId !== Number(rider.id)) {
            return { error: '订单已分配给其他骑手，请走改派流程' };
          }

          const alreadyAssignedToSameRider = currentRiderId === Number(rider.id) && fromStatus === 4;
          if (!alreadyAssignedToSameRider) {
            await order.update({
              rider_id: rider.id,
              status: 4,
              dispatch_center_status: 'sent'
            }, { transaction });

            await OrderLog.create({
              order_id: order.id,
              operator_id: socket.userId || 1,
              operator_type: 'dispatcher',
              action: '大屏派单',
              from_status: fromStatus,
              to_status: 4,
              remark: `调度员派单给骑手：${rider.nickname || rider.phone || rider.id}`
            }, { transaction });
          }

          return {
            orderId: order.id,
            riderId: rider.id,
            oldRiderId: currentRiderId,
            alreadyAssignedToSameRider
          };
        });

        if (dispatchResult.error) {
          return socket.emit('error_msg', { message: dispatchResult.error });
        }

        const refreshed = await Order.findByPk(dispatchResult.orderId, {
          include: [
            { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
            { model: User, as: 'user', attributes: ['nickname', 'phone'] },
            { model: User, as: 'rider', attributes: ['nickname', 'phone'] }
          ]
        });

        if (!refreshed) {
          return socket.emit('error_msg', { message: '派单后订单刷新失败' });
        }

        if (!dispatchResult.alreadyAssignedToSameRider) {
          console.log(`[大屏派单成功] 正在通知骑手 ${dispatchResult.riderId}`);
          notifyRiderNewOrder(dispatchResult.riderId, refreshed);
          notifyUserOrderUpdate(
            refreshed.user_id,
            refreshed,
            '已分配骑手，等待骑手取餐'
          );
          await broadcastDispatcherOrdersUpdate();
        }

        socket.emit('dispatch_success', {
          orderId: refreshed.id,
          order_no: refreshed.order_no,
          riderId: dispatchResult.riderId,
          oldRiderId: dispatchResult.oldRiderId,
          orderStatus: refreshed.status,
          dispatchStatus: refreshed.dispatch_status,
          duplicate: Boolean(dispatchResult.alreadyAssignedToSameRider)
        });

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
      const allowedRooms = new Set([
        `user_${socket.userId}`
      ]);

      if (socket.userRole === 'merchant') {
        allowedRooms.add(`merchant_${socket.userId}`);
      }
      if (socket.userRole === 'rider') {
        allowedRooms.add(`rider_${socket.userId}`);
      }
      if (socket.userRole === 'dispatcher') {
        allowedRooms.add('dispatcher');
        allowedRooms.add('dispatcher_room');
      }

      if (!allowedRooms.has(room)) {
        socket.emit('error_msg', { message: '无权加入该房间' });
        return;
      }

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
  broadcastDispatcherOrdersUpdate,
  emitToUser,
  emitToMerchant,
  emitToRider,
  emitToAllMerchants,
  emitToAllRiders,
  notifyMerchantNewOrder,
  notifyUserOrderUpdate,
  notifyRiderNewOrder
};
