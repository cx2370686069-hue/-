// 这个文件是“Socket 实时通知服务”。
// 它负责整套实时链路：
// 1. Socket 连接鉴权
// 2. 用户 / 商家 / 骑手 / 调度台的房间管理
// 3. 调度大屏订单与坐标广播
// 4. 新订单、订单状态更新、派单通知等实时消息推送
const jwt = require('jsonwebtoken');
const { User, Order, Merchant } = require('../models');
const merchantPushService = require('./merchantPushService');
const {
  DISPATCH_PORTALS,
  resolveOrderDispatchPortal
} = require('../config/dispatchPortal');

// ==================== 连接池与基础缓存区 ====================
let io = null;
const userSockets = new Map();
const merchantSockets = new Map();
const riderSockets = new Map();
const dispatcherSockets = new Map(); // 调度中心连接池 
const riderLastSeen = new Map(); // 看门狗：记录骑手最后上报GPS的时间 
const riderLocations = new Map(); // 缓存骑手最新坐标 
const LOST_CONTACT_THRESHOLD = 30000; // 骑手失联判定阈值 (30秒) 
const socketIdentityCache = new Map();
const SOCKET_IDENTITY_CACHE_TTL = 60000;
const SOCKET_AUTH_DB_TIMEOUT_MS = 8000;
const DISPATCHER_LOCATION_SYNC_INTERVAL_MS = 10000;
const DISPATCHER_MERCHANT_SYNC_INTERVAL_MS = 30000;
const RIDER_NEW_ORDER_NOTIFY_STATUSES = [2, 3, 4, 5, 6];
// #region debug-point B:socket-auth-report
const DEBUG_SOCKET_REPORT_URL = 'http://192.168.1.9:7778/event';
const DEBUG_SOCKET_SESSION_ID = 'socket-timeout';
const DEBUG_SOCKET_RUN_ID = 'pre-fix';
function reportSocketDebug(hypothesisId, msg, data = {}) {
  try {
    const payload = JSON.stringify({
      sessionId: DEBUG_SOCKET_SESSION_ID,
      runId: DEBUG_SOCKET_RUN_ID,
      hypothesisId,
      traceId: data.traceId || '',
      location: 'services/socketService.js',
      msg,
      data,
      ts: Date.now()
    });
    const target = new URL(DEBUG_SOCKET_REPORT_URL);
    const httpClient = target.protocol === 'https:' ? require('https') : require('http');
    const req = httpClient.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (error) {}
}
function readSocketTraceId(socket) {
  return String(socket?.handshake?.query?.debugTraceId || '').trim();
}
// #endregion
let dispatcherLocationSyncTimer = null;
let dispatcherLocationSyncRunning = false;
let dispatcherMerchantSyncTimer = null;
let dispatcherMerchantSyncRunning = false;

// 商家端远程推送走异步 fire-and-forget，避免主链路被推送慢请求卡住。
function fireAndForgetMerchantPush(userId, payload) {
  merchantPushService.notifyMerchantRemotePush(userId, payload).catch((error) => {
    console.error('[merchant-push] dispatch failed', {
      userId,
      error: error?.message || error
    });
  });
}

// ==================== Socket 鉴权工具区 ====================
function createSocketAuthError(reason, details = {}) {
  const error = new Error('Unauthorized');
  error.code = 'SOCKET_AUTH_FAILED';
  error.reason = reason;
  error.details = details;
  return error;
}

function normalizeSocketToken(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
}

// 乡镇名在真实运营里经常会混着出现：
// “郭陆滩”“郭陆滩镇”“固始县郭陆滩镇”
// 如果 socket 推送还用原始字符串硬比对，就会出现
// “数据库能查到订单，但实时通知就是推不到在线骑手”的漏单问题。
// 这里单独收一层归一化，确保实时推送口径和订单侧尽量一致。
function normalizeTownName(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/固始县/g, '')
    .replace(/乡$/, '')
    .replace(/镇$/, '')
    .trim();
}

// 把数据库角色映射成 socket 内部角色。
function toSocketRole(dbRole = '') {
  const normalized = String(dbRole || '').toLowerCase().trim();
  if (normalized === 'admin') {
    return 'dispatcher';
  }
  if (normalized === 'merchant_delivery') {
    return 'rider';
  }
  return ['user', 'merchant', 'rider', 'dispatcher'].includes(normalized) ? normalized : '';
}

function readSocketIdentityCache(token) {
  const cached = socketIdentityCache.get(token);
  if (!cached) {
    return null;
  }
  if (cached.expireAt <= Date.now()) {
    socketIdentityCache.delete(token);
    return null;
  }
  return cached.identity;
}

function writeSocketIdentityCache(token, identity) {
  if (!token || !identity) {
    return;
  }
  socketIdentityCache.set(token, {
    identity,
    expireAt: Date.now() + SOCKET_IDENTITY_CACHE_TTL
  });
}

// 带超时的用户查询，避免 socket 握手一直卡在数据库。
async function findSocketUserById(userId) {
  return Promise.race([
    User.findByPk(userId, {
      attributes: [
        'id',
        'role',
        'status',
        'nickname',
        'phone',
        'delivery_scope',
        'town_name',
        'bound_merchant_id'
      ],
      include: [{
        model: Merchant,
        as: 'boundMerchant',
        attributes: ['id', 'name', 'longitude', 'latitude', 'address', 'phone']
      }]
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(createSocketAuthError('db_timeout', { userId }));
      }, SOCKET_AUTH_DB_TIMEOUT_MS);
    })
  ]);
}

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// 解析当前 socket 的真实身份。
// 这里会校验 token、查数据库状态、再决定它属于 user / merchant / rider / dispatcher 哪一类。
async function resolveSocketIdentity(socket) {
  const token = normalizeSocketToken(
    socket.handshake.auth?.token
    || socket.handshake.query?.token
    || socket.handshake.headers?.authorization
  );
  if (!token) {
    throw createSocketAuthError('missing_token');
  }

  const cachedIdentity = readSocketIdentityCache(token);
  if (cachedIdentity) {
    return cachedIdentity;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw createSocketAuthError('invalid_token');
  }

  const rawUserId = decoded.userId || decoded.id;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createSocketAuthError('invalid_user_id', { rawUserId });
  }

  const user = await findSocketUserById(userId);
  if (!user || Number(user.status) !== 1) {
    throw createSocketAuthError('user_inactive', { userId, status: user?.status });
  }

  const dbRole = String(user.role || '').toLowerCase().trim();
  const socketRole = toSocketRole(dbRole);
  if (!socketRole) {
    throw createSocketAuthError('unsupported_role', { userId, dbRole });
  }

  const identity = {
    userId: user.id,
    userRole: socketRole,
    accountRole: dbRole,
    riderName: user.nickname || '',
    riderPhone: user.phone || '',
    deliveryScope: user.delivery_scope || '',
    townName: normalizeTownName(user.town_name || user.rider_town || ''),
    boundMerchantId: Number(user.bound_merchant_id || 0) || 0,
    boundMerchantName: user.boundMerchant?.name || '',
    boundMerchantLongitude: toFiniteNumber(user.boundMerchant?.longitude),
    boundMerchantLatitude: toFiniteNumber(user.boundMerchant?.latitude),
    boundMerchantAddress: user.boundMerchant?.address || '',
    boundMerchantPhone: user.boundMerchant?.phone || ''
  };
  writeSocketIdentityCache(token, identity);
  return identity;
}

function buildDispatcherLocationPayload(user, extra = {}) {
  const lng = toFiniteNumber(extra.longitude ?? extra.lng ?? user?.rider_longitude);
  const lat = toFiniteNumber(extra.latitude ?? extra.lat ?? user?.rider_latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  const accountRole = String(extra.accountRole || user?.role || '').toLowerCase().trim();
  const riderName = extra.rider_name || extra.driver_name || extra.riderName || user?.nickname || `骑手-${user?.id || 'unknown'}`;
  const riderPhone = extra.rider_phone || extra.riderPhone || user?.phone || '';
  const boundMerchant = user?.boundMerchant || null;
  const boundMerchantId = Number(extra.bound_merchant_id || extra.boundMerchantId || user?.bound_merchant_id || 0) || 0;

  return {
    type: 'location_update',
    vehicleId: String(extra.vehicleId || extra.riderId || user?.id || ''),
    position: [lng, lat],
    speed: Number(extra.speed || 0) || 0,
    direction: Number(extra.direction || 0) || 0,
    status: extra.status || 'idle',
    timestamp: Number(extra.timestamp || Date.now()) || Date.now(),
    role: accountRole,
    user_role: accountRole,
    rider_name: riderName,
    rider_phone: riderPhone,
    delivery_scope: extra.delivery_scope || extra.deliveryScope || user?.delivery_scope || '',
    town_name: normalizeTownName(extra.town_name || extra.townName || user?.town_name || user?.rider_town || ''),
    bound_merchant_id: boundMerchantId,
    merchant_id: boundMerchantId,
    merchant_name: extra.merchant_name || extra.merchantName || boundMerchant?.name || '',
    merchant_lng: toFiniteNumber(extra.merchant_lng ?? extra.merchantLng ?? boundMerchant?.longitude),
    merchant_lat: toFiniteNumber(extra.merchant_lat ?? extra.merchantLat ?? boundMerchant?.latitude),
    merchant_address: extra.merchant_address || extra.merchantAddress || boundMerchant?.address || '',
    merchant_phone: extra.merchant_phone || extra.merchantPhone || boundMerchant?.phone || ''
  };
}

async function getDispatcherLocationSnapshotUsers() {
  const { Op } = require('sequelize');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return User.findAll({
    where: {
      status: 1,
      rider_longitude: { [Op.not]: null },
      rider_latitude: { [Op.not]: null },
      rider_location_updated_at: { [Op.gte]: tenMinutesAgo },
      [Op.or]: [
        { role: 'merchant_delivery' },
        {
          role: 'rider',
          rider_status: 1
        }
      ]
    },
    attributes: [
      'id',
      'role',
      'nickname',
      'phone',
      'delivery_scope',
      'town_name',
      'bound_merchant_id',
      'rider_longitude',
      'rider_latitude',
      'rider_location_updated_at'
    ],
    include: [{
      model: Merchant,
      as: 'boundMerchant',
      attributes: ['id', 'name', 'longitude', 'latitude', 'address', 'phone']
    }],
    order: [['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
  });
}

async function broadcastDispatcherLocationSnapshot(targetSocket = null) {
  if ((!io && !targetSocket) || dispatcherLocationSyncRunning) {
    return;
  }

  dispatcherLocationSyncRunning = true;
  try {
    const activeDeliveryUsers = await getDispatcherLocationSnapshotUsers();
    activeDeliveryUsers.forEach((user) => {
      const payload = buildDispatcherLocationPayload(user, {
        timestamp: user.rider_location_updated_at
          ? new Date(user.rider_location_updated_at).getTime()
          : Date.now()
      });
      if (!payload) {
        return;
      }
      if (targetSocket) {
        targetSocket.emit('location_update', payload);
      } else {
        io.to('dispatcher_room').emit('location_update', payload);
      }
    });
  } catch (error) {
    console.error('推送调度台定位快照失败:', error);
  } finally {
    dispatcherLocationSyncRunning = false;
  }
}

// 广播“审核成功商家”地图快照。
// 调度端收到这份数据后，会按 county / town / merchant 三个入口分别上图。
async function broadcastDispatcherMerchantsUpdate(targetSocket = null) {
  if ((!io && !targetSocket) || dispatcherMerchantSyncRunning) {
    return;
  }

  dispatcherMerchantSyncRunning = true;
  try {
    const merchants = await getDispatcherMerchantsSnapshot();
    const payload = {
      type: 'merchants_update',
      merchants
    };

    if (targetSocket) {
      targetSocket.emit('merchants_update', payload);
      return;
    }

    io.to('dispatcher_room').emit('merchants_update', payload);
  } catch (error) {
    console.error('推送调度台商家地图快照失败:', error);
  } finally {
    dispatcherMerchantSyncRunning = false;
  }
}

function ensureDispatcherLocationSyncTimer() {
  if (dispatcherLocationSyncTimer) {
    return;
  }
  dispatcherLocationSyncTimer = setInterval(() => {
    if (!io || dispatcherSockets.size <= 0) {
      return;
    }
    broadcastDispatcherLocationSnapshot().catch((error) => {
      console.error('调度台10秒定位补推失败:', error);
    });
  }, DISPATCHER_LOCATION_SYNC_INTERVAL_MS);
}

function ensureDispatcherMerchantSyncTimer() {
  if (dispatcherMerchantSyncTimer) {
    return;
  }
  dispatcherMerchantSyncTimer = setInterval(() => {
    if (!io || dispatcherSockets.size <= 0) {
      return;
    }
    broadcastDispatcherMerchantsUpdate().catch((error) => {
      console.error('调度台商家快照补推失败:', error);
    });
  }, DISPATCHER_MERCHANT_SYNC_INTERVAL_MS);
}

// ==================== 调度大屏数据组装区 ====================
function resolveDispatcherTransferMeta(order = {}) {
  const currentRole = String(order.current_responsible_role || '').trim();
  const isTransferOrder = Boolean(order.is_transfer_order);
  const dispatchPortal = resolveOrderDispatchPortal({ order, merchant: order.merchant });
  const isCountyToTownTransfer = isTransferOrder &&
    String(order.order_type || '').trim() === 'county' &&
    ['town_stationmaster', 'town_rider'].includes(currentRole) &&
    String(order.transfer_status || '').trim() !== 'revoked';

  if (!isTransferOrder) {
    if (dispatchPortal === DISPATCH_PORTALS.MERCHANT) {
      return {
        is_transfer_order: false,
        origin_delivery_domain: 'self_delivery',
        current_delivery_domain: 'self_delivery',
        transfer_pool_key: 'merchant_self_pool',
        transfer_stage_text: ''
      };
    }
    return {
      is_transfer_order: false,
      origin_delivery_domain: String(order.order_type || '').trim() === 'town' ? 'town_native_delivery' : 'county_dispatch',
      current_delivery_domain: String(order.order_type || '').trim() === 'town' ? 'town_native_delivery' : 'county_dispatch',
      transfer_pool_key: '',
      transfer_stage_text: ''
    };
  }

  if (String(order.transfer_status || '').trim() === 'revoked') {
    return {
      is_transfer_order: true,
      origin_delivery_domain: 'county_dispatch',
      current_delivery_domain: 'county_dispatch',
      transfer_pool_key: 'county_returned_pool',
      transfer_stage_text: '已退回县城'
    };
  }

  if (isCountyToTownTransfer) {
    return {
      is_transfer_order: true,
      origin_delivery_domain: 'county_dispatch',
      current_delivery_domain: 'county_to_town_transfer',
      transfer_pool_key: currentRole === 'town_rider'
        ? 'county_to_town_rider_pool'
        : 'county_to_town_stationmaster_pool',
      transfer_stage_text: currentRole === 'town_rider' ? '乡镇骑手接力中' : '待乡镇站长接力'
    };
  }

  return {
    is_transfer_order: true,
    origin_delivery_domain: String(order.order_type || '').trim() === 'town' ? 'town_native_delivery' : 'county_dispatch',
    current_delivery_domain: String(order.order_type || '').trim() === 'town' ? 'town_native_delivery' : 'county_dispatch',
    transfer_pool_key: 'generic_transfer',
    transfer_stage_text: '转派处理中'
  };
}

function buildDispatcherRadarOrder(order) {
  const merchant = order.merchant || {};
  const customerLng = toFiniteNumber(order.customer_lng ?? order.delivery_longitude);
  const customerLat = toFiniteNumber(order.customer_lat ?? order.delivery_latitude);
  const merchantLng = toFiniteNumber(order.merchant_lng ?? merchant.longitude);
  const merchantLat = toFiniteNumber(order.merchant_lat ?? merchant.latitude);
  const dispatchPortal = resolveOrderDispatchPortal({ order, merchant });
  const transferMeta = resolveDispatcherTransferMeta(order);
  const type =
    dispatchPortal === DISPATCH_PORTALS.MERCHANT
      ? 'merchant_self'
      : dispatchPortal === DISPATCH_PORTALS.TOWN
        ? 'town'
        : 'county';

  return {
    id: order.order_no,
    order_id: order.id,
    order_no: order.order_no,
    merchant_id: order.merchant_id || merchant.id || null,
    created_at: order.created_at || null,
    createdAt: order.created_at || null,
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
    raw_status: order.status,
    status: order.dispatch_status || 'pending',
    type,
    color: type === 'merchant_self' ? 'orange' : (type === 'county' ? 'blue' : 'red'),
    dispatch_portal: dispatchPortal,
    dispatch_portal_snapshot: order.dispatch_portal_snapshot || null,
    is_transfer_order: transferMeta.is_transfer_order,
    transfer_status: order.transfer_status || '',
    transfer_to_town: order.transfer_to_town_name || order.customer_town || '',
    current_responsible_user_id: order.current_responsible_user_id || null,
    current_responsible_role: order.current_responsible_role || '',
    origin_delivery_domain: transferMeta.origin_delivery_domain,
    current_delivery_domain: transferMeta.current_delivery_domain,
    transfer_pool_key: transferMeta.transfer_pool_key,
    transfer_stage_text: transferMeta.transfer_stage_text,
    products_info: order.products_info,
    delivery_address: order.delivery_address || '',
    address: order.address || order.delivery_address || ''
  };
}

// 把商家表里的审核通过店铺整理成“调度地图专用快照”。
// 这里返回的是地图展示数据，不是商家完整资料，尽量只带地图真正需要的字段。
function buildDispatcherMerchantSnapshot(merchant) {
  const lng = toFiniteNumber(merchant?.longitude);
  const lat = toFiniteNumber(merchant?.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    type: 'merchant_snapshot',
    merchant_id: merchant.id,
    user_id: merchant.user_id || null,
    name: merchant.name || '',
    phone: merchant.phone || '',
    address: merchant.address || '',
    logo: merchant.logo || '',
    position: [lng, lat],
    longitude: lng,
    latitude: lat,
    business_scope: merchant.business_scope || '',
    dispatch_portal: merchant.dispatch_portal || null,
    town_code: merchant.town_code || '',
    town_name: merchant.town_name || '',
    supermarket_delivery_permission: merchant.supermarket_delivery_permission || '',
    audit_status: Number(merchant.audit_status || 0) || 0,
    status: Number(merchant.status || 0) || 0
  };
}

// 生成调度大屏当前活跃订单快照。
async function getDispatcherOrdersSnapshot() {
  const { Op } = require('sequelize');
  const activeOrders = await Order.findAll({
    where: { status: { [Op.in]: [0, 1, 2, 3, 4, 5] } },
    include: [{ model: Merchant, as: 'merchant' }],
    order: [['id', 'DESC']]
  });

  return activeOrders.map(buildDispatcherRadarOrder);
}

// 生成“审核成功商家”的调度地图快照。
// 这里单独查 merchants，是为了让商家即使暂时没有订单，也能在对应地图入口看到店铺点位。
async function getDispatcherMerchantsSnapshot() {
  const { Op } = require('sequelize');
  const merchants = await Merchant.findAll({
    where: {
      audit_status: 1,
      longitude: { [Op.not]: null },
      latitude: { [Op.not]: null }
    },
    attributes: [
      'id',
      'user_id',
      'name',
      'phone',
      'address',
      'logo',
      'longitude',
      'latitude',
      'business_scope',
      'dispatch_portal',
      'town_code',
      'town_name',
      'supermarket_delivery_permission',
      'audit_status',
      'status'
    ],
    order: [['id', 'DESC']]
  });

  return merchants
    .map(buildDispatcherMerchantSnapshot)
    .filter(Boolean);
}

// 广播调度大屏订单更新。
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
 * 这是整个实时系统的入口：创建 io 实例、配置鉴权、中间件、房间管理、消息监听。
 */
function init(server) {
  io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000
  });
  ensureDispatcherLocationSyncTimer();
  ensureDispatcherMerchantSyncTimer();

  if (io?.engine && typeof io.engine.on === 'function') {
    io.engine.on('connection_error', (error) => {
      // #region debug-point C:engine-connection-error
      reportSocketDebug('C', '[DEBUG] backend engine connection_error', {
        traceId: readSocketTraceId(error?.req?._query ? { handshake: { query: error.req._query } } : null),
        code: error?.code || '',
        message: error?.message || '',
        type: error?.type || '',
        context: error?.context || ''
      });
      // #endregion
      console.error('[socket:engine:connection_error]', {
        code: error?.code || '',
        message: error?.message || '',
        type: error?.type || '',
        context: error?.context || ''
      });
    });
  }

  io.use(async (socket, next) => {
    const traceId = readSocketTraceId(socket);
    const authStartedAt = Date.now();
    // #region debug-point B:auth-start
    reportSocketDebug('B', '[DEBUG] backend socket auth start', {
      traceId,
      transport: socket?.conn?.transport?.name || socket?.handshake?.transport || '',
      hasAuthToken: !!socket.handshake?.auth?.token,
      hasQueryToken: !!socket.handshake?.query?.token,
      hasAuthorizationHeader: !!socket.handshake?.headers?.authorization,
      userAgent: socket.handshake?.headers?.['user-agent'] || '',
      address: socket.handshake?.address || ''
    });
    // #endregion
    try {
      const identity = await resolveSocketIdentity(socket);
      // #region debug-point B:auth-success
      reportSocketDebug('B', '[DEBUG] backend socket auth success', {
        traceId,
        userId: identity.userId,
        userRole: identity.userRole,
        accountRole: identity.accountRole,
        deliveryScope: identity.deliveryScope || '',
        durationMs: Date.now() - authStartedAt
      });
      // #endregion
      socket.userId = identity.userId;
      socket.userRole = identity.userRole;
      socket.accountRole = identity.accountRole;
      socket.riderName = identity.riderName || '';
      socket.riderPhone = identity.riderPhone || '';
      socket.deliveryScope = identity.deliveryScope || '';
      socket.townName = identity.townName || '';
      socket.boundMerchantId = identity.boundMerchantId || 0;
      socket.boundMerchantName = identity.boundMerchantName || '';
      socket.boundMerchantLongitude = identity.boundMerchantLongitude ?? null;
      socket.boundMerchantLatitude = identity.boundMerchantLatitude ?? null;
      socket.boundMerchantAddress = identity.boundMerchantAddress || '';
      socket.boundMerchantPhone = identity.boundMerchantPhone || '';
      next();
    } catch (error) {
      // #region debug-point B:auth-fail
      reportSocketDebug('B', '[DEBUG] backend socket auth fail', {
        traceId,
        reason: error?.reason || '',
        message: error?.message || 'Unauthorized',
        details: error?.details || {},
        durationMs: Date.now() - authStartedAt,
        hasAuthToken: !!socket.handshake?.auth?.token,
        hasQueryToken: !!socket.handshake?.query?.token
      });
      // #endregion
      console.error('[socket:auth:fail]', {
        reason: error?.reason || '',
        message: error?.message || 'Unauthorized',
        details: error?.details || {},
        handshakeAddress: socket.handshake?.address || '',
        hasAuthToken: !!socket.handshake?.auth?.token,
        hasQueryToken: !!socket.handshake?.query?.token
      });
      next(error instanceof Error ? error : createSocketAuthError('unknown'));
    }
  });

  io.on('connection', (socket) => {
    // #region debug-point B:connection-established
    reportSocketDebug('B', '[DEBUG] backend socket connection established', {
      traceId: readSocketTraceId(socket),
      userId: socket.userId || '',
      userRole: socket.userRole || '',
      socketId: socket.id,
      transport: socket?.conn?.transport?.name || ''
    });
    // #endregion
    console.log(`用户连接: ${socket.userId} (${socket.userRole})`, {
      socketId: socket.id,
      transport: socket.conn?.transport?.name || ''
    });

    // 真正建立连接后，按账号身份分配到不同连接池和房间。
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

      // 调度大屏刚连上时，主动补发一次当前活跃订单和骑手坐标，避免大屏空白。
      setTimeout(async () => {
        try {
          await broadcastDispatcherOrdersUpdate(socket);
          await broadcastDispatcherLocationSnapshot(socket);
          await broadcastDispatcherMerchantsUpdate(socket);
          
          const activeOrders = await getDispatcherOrdersSnapshot();
          const activeMerchants = await getDispatcherMerchantsSnapshot();
          console.log(`[大屏初始化] 已向调度员 ${socket.userId} 推送 ${activeOrders.length} 个活跃订单、定位快照和 ${activeMerchants.length} 个审核通过商家点位`);
        } catch (err) {
          console.error('初始化大屏数据失败:', err);
        }
      }, 1500); // 稍微延迟一下等前端渲染好
    } else {
      userSockets.set(socket.userId, socket);
      socket.join(`user_${socket.userId}`);
    }

    // 骑手通过 socket 上报位置后，这里会同步：
    // 1. 更新内存中的最新坐标
    // 2. 异步回写数据库
    // 3. 广播给调度大屏
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

        const cleanData = buildDispatcherLocationPayload({
          id: socket.userId,
          role: socket.accountRole,
          nickname: socket.riderName,
          phone: socket.riderPhone,
          delivery_scope: socket.deliveryScope,
          town_name: socket.townName,
          bound_merchant_id: socket.boundMerchantId,
          boundMerchant: socket.boundMerchantId ? {
            id: socket.boundMerchantId,
            name: socket.boundMerchantName,
            longitude: socket.boundMerchantLongitude,
            latitude: socket.boundMerchantLatitude,
            address: socket.boundMerchantAddress,
            phone: socket.boundMerchantPhone
          } : null
        }, {
          vehicleId: String(data.vehicleId || socket.userId),
          longitude: cleanPosition[0],
          latitude: cleanPosition[1],
          speed: data.speed || 0,
          direction: data.direction || 0,
          status: currentStatus,
          timestamp: Date.now(),
          rider_name: data.rider_name || socket.riderName,
          rider_phone: data.rider_phone || socket.riderPhone,
          delivery_scope: data.delivery_scope || socket.deliveryScope,
          town_name: data.town_name || socket.townName
        });
        if (!cleanData) {
          return;
        }
        
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

    // 调度大屏派单主逻辑。
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

    // 兼容原生 WebSocket 的 message 事件，因为调度大屏可能直接用 ws.send。
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

    // 给调度大屏提供简单心跳响应。
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
 * 其他服务如果想主动发实时消息，会先从这里拿到 io。
 */
function getIO() {
  return io;
}

/**
 * 向指定用户推送消息
 * 这里只做最基础的 emit，不拼业务消息结构。
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

/**
 * 向指定商家推送消息
 * 这里只做最基础的 emit，不拼业务消息结构。
 */
function emitToMerchant(userId, event, data) {
  if (io) {
    io.to(`merchant_${userId}`).emit(event, data);
  }
}

/**
 * 向指定骑手推送消息
 * 这里只做最基础的 emit，不拼业务消息结构。
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
 * 按配送范围定向推给在线骑手。
 * 这个入口专门处理“还没指派到具体 rider_id，但某一批骑手已经能看见这笔单”的场景。
 */
function emitToScopedRiders(event, buildPayload, matcher) {
  if (!io || typeof buildPayload !== 'function' || typeof matcher !== 'function') {
    return 0;
  }

  let deliveredCount = 0;
  riderSockets.forEach((socket) => {
    try {
      if (!matcher(socket)) {
        return;
      }
      const payload = buildPayload(socket);
      if (!payload) {
        return;
      }
      socket.emit(event, payload);
      deliveredCount += 1;
    } catch (error) {
      console.error('[socket:rider:scoped-emit-failed]', {
        event,
        userId: socket?.userId || null,
        message: error?.message || error
      });
    }
  });

  return deliveredCount;
}

/**
 * 推送新订单通知给商家
 * 商家端既会收到 socket 实时通知，也会尝试触发远程推送。
 */
function notifyMerchantNewOrder(merchantUserId, order, options = {}) {
  const payload = {
    type: 'new_order',
    eventType: options?.eventType || 'merchant_new_order',
    title: options?.title || '新订单',
    message: options?.message || `您有一个新订单，订单号: ${order.order_no}`,
    speechText: options?.speechText || '您有新的订单，请及时处理',
    soundType: options?.soundType || 'merchant_new_order',
    priority: options?.priority || 'high',
    jumpPath: options?.jumpPath || '/pages/order/list',
    dedupeKey: options?.dedupeKey || `merchant_new_order:${order?.id || order?.order_no || Date.now()}`,
    data: order,
    timestamp: new Date()
  };

  emitToMerchant(merchantUserId, 'new_order', payload);
  fireAndForgetMerchantPush(merchantUserId, payload);
}

/**
 * 推送订单提醒给商家
 * 这个入口偏提醒类事件，比如订单状态推进后提醒商家回到列表处理。
 */
function notifyMerchantReminder(merchantUserId, order, options = {}) {
  const payload = {
    type: options?.eventType || 'merchant_reminder',
    eventType: options?.eventType || 'merchant_reminder',
    title: options?.title || '商家提醒',
    message: options?.message || '您有新的订单提醒',
    speechText: options?.speechText || '您有新的订单提醒，请及时查看',
    soundType: options?.soundType || 'merchant_reminder',
    priority: options?.priority || 'medium',
    jumpPath: options?.jumpPath || '/pages/order/list',
    dedupeKey: options?.dedupeKey || `merchant_reminder:${order?.id || order?.order_no || Date.now()}`,
    data: order,
    timestamp: new Date()
  };

  emitToMerchant(merchantUserId, payload.type, payload);
  fireAndForgetMerchantPush(merchantUserId, payload);
}

/**
 * 推送订单状态更新给用户
 * 用户侧主要靠这个入口感知订单状态变化。
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
 * 骑手拿到新配送任务时，主要从这里收到实时通知。
 */
function notifyRiderNewOrder(riderUserId, order, options = {}) {
  const eventType = options?.eventType || 'rider_new_delivery';
  const orderStatus = Number(order?.status || 0);
  if (eventType !== 'rider_transfer_assigned' && !RIDER_NEW_ORDER_NOTIFY_STATUSES.includes(orderStatus)) {
    // status=1 只是“用户已付款，等商家接单”，这一步只能通知商家，不能给骑手播新配送语音。
    // 没带状态的异常数据也先挡住：骑手语音宁可等下一次状态明确的推送或轮询，也不能提前播错。
    // 这里挡的是后端所有单骑手派单入口，避免某条业务链路绕过乡镇骑手池的状态保护。
    console.warn('[rider-notify] skip premature new delivery reminder', {
      riderUserId,
      orderId: order?.id || order?.order_no || '',
      status: orderStatus,
      eventType
    });
    return 0;
  }

  const payload = {
    type: 'new_delivery',
    eventType,
    title: options?.title || '新配送任务',
    message: options?.message || '您有一个新的配送任务',
    speechText: options?.speechText || '您有新的配送订单，请及时处理',
    soundType: options?.soundType || 'rider_new_delivery',
    priority: options?.priority || 'high',
    jumpPath: options?.jumpPath || '/pages/orders/index',
    dedupeKey: options?.dedupeKey || `rider_new_delivery:${order?.id || order?.order_no || Date.now()}:${riderUserId}`,
    data: order,
    timestamp: new Date()
  };

  emitToRider(riderUserId, 'new_delivery', payload);
  return 1;
}

/**
 * 商家刚接单后，乡镇待接单池里的骑手端要立刻有声音。
 * 这里不等后续轮询，也不等商家出餐，先把“这笔单已经进入可见待接单池”的消息实时推给同乡镇在线骑手。
 */
function notifyTownRiderPoolNewOrder(order, options = {}) {
  if (!order || ![2, 3, 4].includes(Number(order.status || 0))) {
    return 0;
  }

  const targetTownName = normalizeTownName(
    options?.townName
    || order?.customer_town
    || order?.transfer_to_town_name
    || ''
  );

  if (!targetTownName) {
    return 0;
  }
  // #region debug-point C:town-pool-push
  fetch("http://192.168.1.9:7788/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"rider-hidden-order",runId:"pre-fix",hypothesisId:"C",location:"services/socketService.js:notifyTownRiderPoolNewOrder",msg:"[DEBUG] 准备向乡镇骑手池推送新单语音",data:{orderId:order?.id??null,status:Number(order?.status||0),orderType:order?.order_type||"",customerTown:order?.customer_town||"",transferTown:order?.transfer_to_town_name||"",targetTownName,merchantName:String(options?.merchantName || order?.merchant?.name || '商家').trim() || '商家'},ts:Date.now()})}).catch(()=>{});
  // #endregion

  const merchantName = String(options?.merchantName || order?.merchant?.name || '商家').trim() || '商家';
  const orderId = order?.id || order?.order_no || Date.now();

  return emitToScopedRiders(
    'new_delivery',
    (socket) => ({
      type: 'new_delivery',
      eventType: options?.eventType || 'rider_new_delivery',
      title: options?.title || '商家已接单',
      message: options?.message || `${merchantName}已接单，订单进入待接单池`,
      speechText: options?.speechText || `${merchantName}已接单，请及时查看并接单`,
      soundType: options?.soundType || 'rider_new_delivery',
      priority: options?.priority || 'high',
      jumpPath: options?.jumpPath || '/pages/orders/index',
      dedupeKey: options?.dedupeKey || `town_pool_accept:${orderId}:${socket.userId}`,
      data: order,
      timestamp: new Date()
    }),
    (socket) => String(socket?.deliveryScope || '').trim() === 'town_delivery'
      && normalizeTownName(socket?.townName || '') === targetTownName
  );
}

module.exports = {
  init,
  getIO,
  broadcastDispatcherOrdersUpdate,
  broadcastDispatcherMerchantsUpdate,
  emitToUser,
  emitToMerchant,
  emitToRider,
  emitToAllMerchants,
  emitToAllRiders,
  notifyMerchantNewOrder,
  notifyMerchantReminder,
  notifyUserOrderUpdate,
  notifyRiderNewOrder,
  notifyTownRiderPoolNewOrder
};
