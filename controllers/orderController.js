// 这个文件是“订单总控制器”。
// 用户下单、估算配送费、支付、查单、评价、取消订单、商家接单出餐、骑手接单配送、转派、跑腿单，整条链路基本都在这里。
const crypto = require('crypto');
const { Order, OrderLog, Merchant, Product, ProductSpec, User, CountyOrderGroup, CartItem, Review, Refund, OrderTransfer, sequelize } = require('../models');
const { generateOrderNo, successResponse, errorResponse, calculateDistance } = require('../utils/helpers');
const { round2, normalizePayChannel, computeDeliveryFee, computeTakeoutSettlement } = require('../utils/payment');
const paymentService = require('../services/paymentService');
const riderDispatchService = require('../services/riderDispatchService');
const dispatchCenterService = require('../services/dispatchCenterService');
const socketService = require('../services/socketService');
const routePlanningService = require('../services/routePlanningService');
const { resolveAreaByCoordinate, resolveLocationContextByCoordinate } = require('../services/serviceAreaSearchService');
const { Op } = require('sequelize');
const { normalizeMerchantCategory } = require('../config/merchantCategories');
const {
  SUPERMARKET_DELIVERY_PERMISSIONS,
  SUPERMARKET_DELIVERY_MODES,
  SUPERMARKET_SETTLEMENT_RULES,
  normalizeSupermarketDeliveryPermission,
  normalizeSupermarketDeliveryMode,
  resolveInitialSupermarketDeliveryMode
} = require('../config/supermarketDelivery');
const {
  DELIVERY_RESPONSIBLE_ROLES
} = require('../src/domains/delivery/shared/constants');
const {
  normalizeDeliveryLogOperatorType
} = require('../src/domains/delivery/shared/log-policy');
const {
  buildMerchantDeliveryVisibleOrderWhere: buildMerchantDeliveryVisibleOrderWherePolicy,
  buildRiderOwnedOrderWhere: buildRiderOwnedOrderWherePolicy,
  buildRiderVisibleOrderWhere: buildRiderVisibleOrderWherePolicy,
  canMerchantDeliveryViewOrderDetail: canMerchantDeliveryViewOrderDetailPolicy,
  canRiderViewOrderDetail: canRiderViewOrderDetailPolicy
} = require('../src/domains/delivery/policies/order-visibility.policy');
const {
  buildDeliveryOrderPresentation
} = require('../src/domains/delivery/policies/order-actions.policy');
const {
  prepareMerchantSelfDeliveryStart
} = require('../src/domains/delivery/services/start-delivery.service');
const {
  prepareMerchantSelfDeliveryCompletion,
  prepareRiderDeliveryCompletion
} = require('../src/domains/delivery/services/complete-delivery.service');

const SUPERMARKET_CATEGORY = '超市';
const MERCHANT_DELIVERY_ROLE = DELIVERY_RESPONSIBLE_ROLES.MERCHANT_DELIVERY;
const COUNTY_GROUP_EXTRA_STORE_FEE = 1;
const DELIVERY_TIME_TYPES = {
  ASAP: 'asap',
  SCHEDULED: 'scheduled'
};
const SCHEDULED_DELIVERY_MIN_MINUTES = 40;
const SCHEDULED_DELIVERY_MAX_DAYS = 7;

// ==================== 支付模式与自动确认辅助区 ====================
// 这一段主要处理 mock 支付、自动确认支付、支付后通知商家。
const isMockAutoConfirmEnabled = (mode) => {
  if (mode !== 'mock') {
    return false;
  }
  return process.env.PAYMENT_AUTO_CONFIRM_ON_ORDER_PAY === 'true';
};

const isMockAutoConfirmOnCreateEnabled = (mode) => {
  if (mode !== 'mock') {
    return false;
  }
  return process.env.PAYMENT_AUTO_CONFIRM_ON_ORDER_CREATE === 'true';
};

const buildMockConfirmMeta = () => {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  return {
    tradeNo: `AUTO-MOCK-${suffix}`,
    notifyId: `AUTO-MOCK-NOTIFY-${suffix}`
  };
};

const notifyMerchantForPaidOrder = async (order) => {
  if (!order?.merchant_id) {
    return;
  }
  const merchant = await Merchant.findByPk(order.merchant_id);
  if (merchant?.user_id) {
    socketService.notifyMerchantNewOrder(merchant.user_id, order);
  }
};

const notifyMerchantsForPaidOrders = async (orders = []) => {
  for (const order of orders) {
    await notifyMerchantForPaidOrder(order);
  }
};

const autoConfirmSingleOrderIfNeeded = async ({ order, userId, source }) => {
  const mode = process.env.PAYMENT_MODE || 'mock';
  if (!isMockAutoConfirmOnCreateEnabled(mode) || !order) {
    return { enabled: false, order };
  }
  const now = new Date();
  if (Number(order.status) !== 0) {
    return { enabled: true, order };
  }

  if (order.type === 'takeout') {
    await order.update({
      status: 1,
      paid_at: now,
      payment_channel: 'mock',
      ...buildTakeoutSettlementPatch(order)
    });
  } else {
    await order.update({
      status: 1,
      paid_at: now,
      payment_channel: 'mock',
      commission_amount: 0,
      rider_incentive_amount: 0,
      platform_income_amount: 0,
      merchant_income_amount: 0
    });
  }
  await order.reload();

  await OrderLog.create({
    order_id: order.id,
    operator_type: 'system',
    action: '创建订单后模拟自动支付',
    from_status: 0,
    to_status: 1,
    remark: `${source} 已直推为待接单`
  });
  console.log(`[order.create.auto_paid] order_id=${order.id} status=${order.status} payment_channel=${order.payment_channel}`);

  return {
    enabled: true,
    order
  };
};

const autoConfirmCountyGroupIfNeeded = async ({ countyOrderGroup, userId, source }) => {
  const mode = process.env.PAYMENT_MODE || 'mock';
  if (!isMockAutoConfirmOnCreateEnabled(mode) || !countyOrderGroup) {
    return { enabled: false, countyOrderGroup, orders: [] };
  }
  const now = new Date();
  if (Number(countyOrderGroup.status) === 0) {
    await countyOrderGroup.update({
      status: 1,
      paid_at: now,
      payment_channel: 'mock'
    });
  }
  await countyOrderGroup.reload();

  const orders = await Order.findAll({
    where: { merge_group_id: countyOrderGroup.id }
  });
  for (const order of orders) {
    if (Number(order.status) !== 0) {
      continue;
    }
    if (order.type === 'takeout') {
      await order.update({
        status: 1,
        paid_at: now,
        payment_channel: 'mock',
        ...buildTakeoutSettlementPatch(order)
      });
    } else {
      await order.update({
        status: 1,
        paid_at: now,
        payment_channel: 'mock',
        commission_amount: 0,
        rider_incentive_amount: 0,
        platform_income_amount: 0,
        merchant_income_amount: 0
      });
    }
    await OrderLog.create({
      order_id: order.id,
      operator_type: 'system',
      action: '拼单创建后模拟自动支付',
      from_status: 0,
      to_status: 1,
      remark: `${source} 已直推为待接单`
    });
  }
  console.log(`[county.group.create.auto_paid] group_id=${countyOrderGroup.id} status=${countyOrderGroup.status} orders=${orders.length}`);

  return {
    enabled: true,
    countyOrderGroup,
    orders
  };
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeDeliveryTimeType = (rawValue) => {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value || value === DELIVERY_TIME_TYPES.ASAP || value === 'immediate') {
    return DELIVERY_TIME_TYPES.ASAP;
  }
  if (value === DELIVERY_TIME_TYPES.SCHEDULED || value === 'appointment' || value === 'reserve') {
    return DELIVERY_TIME_TYPES.SCHEDULED;
  }
  return null;
};

const normalizeScheduledDeliveryAt = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const resolveDeliverySchedule = ({ deliveryType, deliveryTimeType, scheduledDeliveryAt }) => {
  const normalizedType = normalizeDeliveryTimeType(deliveryTimeType);
  if (!normalizedType) {
    return { error: '配送时间类型不支持' };
  }

  if (Number(deliveryType) !== 1 && normalizedType === DELIVERY_TIME_TYPES.SCHEDULED) {
    return { error: '自取订单暂不支持预约时间' };
  }

  if (normalizedType === DELIVERY_TIME_TYPES.ASAP) {
    return {
      deliveryTimeType: DELIVERY_TIME_TYPES.ASAP,
      scheduledDeliveryAt: null
    };
  }

  const normalizedScheduledAt = normalizeScheduledDeliveryAt(scheduledDeliveryAt);
  if (!normalizedScheduledAt) {
    return { error: '请选择有效的预约时间' };
  }

  const now = Date.now();
  const minTime = now + SCHEDULED_DELIVERY_MIN_MINUTES * 60 * 1000;
  const maxTime = now + SCHEDULED_DELIVERY_MAX_DAYS * 24 * 60 * 60 * 1000;
  const scheduledAtMs = normalizedScheduledAt.getTime();

  if (scheduledAtMs < minTime) {
    return { error: `预约时间必须晚于当前时间${SCHEDULED_DELIVERY_MIN_MINUTES}分钟` };
  }
  if (scheduledAtMs > maxTime) {
    return { error: `预约时间暂只支持未来${SCHEDULED_DELIVERY_MAX_DAYS}天内` };
  }

  return {
    deliveryTimeType: DELIVERY_TIME_TYPES.SCHEDULED,
    scheduledDeliveryAt: normalizedScheduledAt
  };
};

// ==================== 参数清洗与订单归属辅助区 ====================
// 这一段统一处理数字、时间、商家归属、骑手归属、乡镇范围、转派角色等底层规则。
const findOwnedMerchantByUserId = async (userId) => {
  return Merchant.findOne({ where: { user_id: userId } });
};

const isMerchantDeliveryUser = (user = {}) => user?.role === MERCHANT_DELIVERY_ROLE;

const findBoundMerchantByUser = async (user = {}) => {
  if (!user?.bound_merchant_id) {
    return null;
  }
  return Merchant.findByPk(user.bound_merchant_id);
};

const findOperableMerchantByUser = async (user = {}) => {
  if (isMerchantDeliveryUser(user)) {
    return findBoundMerchantByUser(user);
  }
  return findOwnedMerchantByUserId(user.id);
};

const getMerchantOrderOwnershipError = (merchant, order) => {
  if (!merchant || !order) {
    return '订单不存在';
  }

  if (merchant.business_scope === 'county_food' && order.order_type === 'town') {
    return '县城商家不能操作乡镇订单';
  }

  if (merchant.business_scope === 'town_food' && order.order_type !== 'town') {
    return '乡镇商家不能操作县城订单';
  }

  if (
    merchant.business_scope === 'town_food' &&
    merchant.town_name &&
    order.customer_town &&
    merchant.town_name !== order.customer_town
  ) {
    return '乡镇商家不能操作非本乡镇订单';
  }

  return null;
};

const buildMerchantDeliveryVisibleOrderWhere = (user = {}, effectivePermission = null) => {
  return buildMerchantDeliveryVisibleOrderWherePolicy({ user, effectivePermission });
};

const canMerchantDeliveryViewOrderDetail = (user = {}, order = {}) => {
  return canMerchantDeliveryViewOrderDetailPolicy({ user, order });
};

const resolveRiderScope = (user) => {
  if (user.delivery_scope === 'town_delivery') {
    return {
      delivery_scope: 'town_delivery',
      town_name: user.town_name || user.rider_town || null
    };
  }

  if (user.delivery_scope === 'county_delivery') {
    return {
      delivery_scope: 'county_delivery',
      town_name: null
    };
  }

  if (user.rider_kind === 'stationmaster' || user.rider_town) {
    return {
      delivery_scope: 'town_delivery',
      town_name: user.town_name || user.rider_town || null
    };
  }

  return {
    delivery_scope: 'county_delivery',
    town_name: null
  };
};

const isTownStationmaster = (user) => {
  if (user?.role !== 'rider') {
    return false;
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'town_delivery') {
    return false;
  }

  return user?.rider_kind === 'stationmaster' || user?.rider_level === 'captain';
};

const buildTownRiderUserWhere = ({ townName, excludeUserId } = {}) => {
  const normalizedTownName = normalizeTownName(townName);
  const andConditions = [
    {
      [Op.or]: [
        { rider_level: 'normal' },
        { rider_level: null }
      ]
    },
    {
      [Op.or]: [
        { rider_kind: 'rider' },
        { rider_kind: null }
      ]
    }
  ];

  if (normalizedTownName) {
    andConditions.push({
      [Op.or]: [
        { town_name: normalizedTownName },
        { rider_town: normalizedTownName }
      ]
    });
  }

  const where = {
    role: 'rider',
    status: 1,
    rider_audit_status: 1,
    delivery_scope: 'town_delivery',
    [Op.and]: andConditions
  };

  if (Number.isInteger(Number(excludeUserId)) && Number(excludeUserId) > 0) {
    where.id = { [Op.ne]: Number(excludeUserId) };
  }

  return where;
};

const buildRiderOwnedOrderWhere = (user) => {
  return buildRiderOwnedOrderWherePolicy({ user });
};

const buildRiderVisibleOrderWhere = (user) => {
  return buildRiderVisibleOrderWherePolicy({ user });
};

const getRiderOrderOwnershipError = (user, order) => {
  const scope = resolveRiderScope(user);

  if (scope.delivery_scope === 'town_delivery') {
    if (order.order_type !== 'town') {
      return '乡镇骑手不能接县城订单';
    }

    if (scope.town_name && order.customer_town && scope.town_name !== order.customer_town) {
      return '乡镇骑手不能接非本乡镇订单';
    }

    return null;
  }

  if (order.order_type === 'town') {
    return '县城骑手不能接乡镇订单';
  }

  return null;
};

const canRiderViewOrderDetail = (user, order) => {
  return canRiderViewOrderDetailPolicy({ user, order });
};

const parseAddressPayload = (deliveryAddress) => {
  if (!deliveryAddress) {
    return null;
  }
  if (typeof deliveryAddress === 'object') {
    return deliveryAddress;
  }
  if (typeof deliveryAddress !== 'string') {
    return null;
  }
  try {
    return JSON.parse(deliveryAddress);
  } catch (error) {
    return null;
  }
};

const resolveCustomerCoordinates = (payload = {}) => {
  const addressPayload = parseAddressPayload(payload.delivery_address);
  const lng = toFiniteNumber(
    payload.customer_lng ??
      payload.delivery_longitude ??
      payload.customerLng ??
      payload.deliveryLongitude ??
      addressPayload?.lng ??
      addressPayload?.longitude
  );
  const lat = toFiniteNumber(
    payload.customer_lat ??
      payload.delivery_latitude ??
      payload.customerLat ??
      payload.deliveryLatitude ??
      addressPayload?.lat ??
      addressPayload?.latitude
  );
  return { lng, lat, addressPayload };
};

const normalizeTownName = (value) => String(value || '').trim();

const buildTransferUserSummary = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    nickname: user.nickname || '',
    phone: user.phone || '',
    rider_kind: user.rider_kind || '',
    rider_level: user.rider_level || '',
    delivery_scope: user.delivery_scope || '',
    town_name: user.town_name || user.rider_town || ''
  };
};

const serializeTransferRecord = (record) => {
  if (!record) {
    return null;
  }

  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;
  return {
    id: plain.id,
    order_id: plain.order_id,
    transfer_round: Number(plain.transfer_round || 0),
    from_user_id: plain.from_user_id,
    to_user_id: plain.to_user_id,
    from_role: plain.from_role || '',
    to_role: plain.to_role || '',
    from_scope: plain.from_scope || '',
    to_scope: plain.to_scope || '',
    from_town_name: plain.from_town_name || '',
    to_town_name: plain.to_town_name || '',
    status_before_transfer: Number(plain.status_before_transfer || 0),
    remark: plain.remark || '',
    is_revoked: Boolean(plain.is_revoked),
    revoked_at: plain.revoked_at || null,
    revoke_remark: plain.revoke_remark || '',
    created_at: plain.created_at || null,
    from_user: buildTransferUserSummary(plain.fromUser),
    to_user: buildTransferUserSummary(plain.toUser),
    revoked_by_user: buildTransferUserSummary(plain.revokedByUser)
  };
};

const resolveTransferActorRole = (user) => {
  const scope = resolveRiderScope(user);
  if (scope.delivery_scope === 'town_delivery') {
    return user?.rider_kind === 'stationmaster' || user?.rider_level === 'captain'
      ? 'town_stationmaster'
      : 'town_rider';
  }

  return 'county_rider';
};

const buildTransferOrderWhere = (rawOrderId) => {
  const normalizedOrderId = String(rawOrderId || '').trim();
  const numericOrderId = Number(normalizedOrderId);
  const conditions = [];

  if (Number.isInteger(numericOrderId) && numericOrderId > 0) {
    conditions.push({ id: numericOrderId });
  }
  if (normalizedOrderId) {
    conditions.push({ order_id: normalizedOrderId });
  }

  if (!conditions.length) {
    return null;
  }

  return conditions.length === 1 ? conditions[0] : { [Op.or]: conditions };
};

const findTransferOrderByInput = async (rawOrderId) => {
  const where = buildTransferOrderWhere(rawOrderId);
  if (!where) {
    return null;
  }

  return Order.findOne({
    where,
    include: [
      { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
      { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
    ]
  });
};

const findTownStationmasterByTownName = async (townName) => {
  const resolvedTownName = normalizeTownName(townName);
  if (!resolvedTownName) {
    return null;
  }

  return User.findOne({
    where: {
      role: 'rider',
      status: 1,
      delivery_scope: 'town_delivery',
      rider_level: 'captain',
      [Op.or]: [
        { town_name: resolvedTownName },
        { rider_town: resolvedTownName }
      ]
    },
    order: [['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
  });
};

const getLatestOrderTransfer = async (orderId, options = {}) => {
  return OrderTransfer.findOne({
    where: { order_id: orderId },
    order: [['id', 'DESC']],
    transaction: options.transaction
  });
};

const getOrderTransferChain = async (orderId, limit = 10) => {
  const transfers = await OrderTransfer.findAll({
    where: { order_id: orderId },
    include: [
      { model: User, as: 'fromUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
      { model: User, as: 'toUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
      { model: User, as: 'revokedByUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] }
    ],
    order: [['id', 'DESC']],
    limit
  });

  return transfers.map(serializeTransferRecord);
};

const canRiderTransferOrder = (user, order) => {
  if (user?.role !== 'rider') {
    return false;
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'county_delivery') {
    return false;
  }

  if (order?.type !== 'takeout' || order?.order_type !== 'county') {
    return false;
  }

  if (![3, 4, 5].includes(Number(order.status))) {
    return false;
  }

  return Number(order.rider_id) === Number(user.id);
};

const canTownDispatcherTransferToRider = (user, order) => {
  if (user?.role !== 'rider') {
    return false;
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'town_delivery') {
    return false;
  }

  if (order?.type !== 'takeout' || order?.order_type !== 'town') {
    return false;
  }

  if (![3, 4, 5].includes(Number(order?.status))) {
    return false;
  }

  const orderTownName = normalizeTownName(order?.customer_town || order?.transfer_to_town_name);
  if (scope.town_name && orderTownName && scope.town_name !== orderTownName) {
    return false;
  }

  const currentOwnerId = Number(order?.current_responsible_user_id || order?.rider_id || 0);
  return currentOwnerId === Number(user.id);
};

const canRiderRevokeTransfer = (user, order, latestTransfer) => {
  if (user?.role !== 'rider' || !latestTransfer) {
    return false;
  }

  if (Boolean(latestTransfer.is_revoked) || Boolean(order?.transfer_revoke_used)) {
    return false;
  }

  if (String(order?.transfer_last_action_type || '') !== 'transfer') {
    return false;
  }

  if (![3, 4, 5].includes(Number(order?.status))) {
    return false;
  }

  if (Number(latestTransfer.from_user_id) !== Number(user.id)) {
    return false;
  }

  if (Number(order?.current_responsible_user_id) !== Number(latestTransfer.to_user_id)) {
    return false;
  }

  return Number(order?.status) === Number(latestTransfer.status_before_transfer);
};

const canTownDispatcherRevokeTransferToRider = (user, order, latestTransfer) => {
  if (!canRiderRevokeTransfer(user, order, latestTransfer)) {
    return false;
  }

  return ['town_stationmaster', 'town_rider'].includes(latestTransfer?.from_role) && latestTransfer?.to_role === 'town_rider';
};

const resolveTransferTag = (latestTransfer, order) => {
  if (!order?.is_transfer_order) {
    return '';
  }

  if (!latestTransfer) {
    return '转派单';
  }

  if (latestTransfer.from_role === 'town_stationmaster' && latestTransfer.to_role === 'town_rider') {
    return '站长转骑手';
  }

  if (latestTransfer.from_role === 'county_rider' && latestTransfer.to_role === 'town_stationmaster') {
    return '县城转站长';
  }

  return '转派单';
};

const buildOrderTransferMeta = ({ order, currentUser, transferChain = [] }) => {
  const latestTransfer = transferChain[0] || null;
  const resolvedTransferTown = order.transfer_to_town_name || order.customer_town || '';
  return {
    is_transfer_order: Boolean(order.is_transfer_order),
    transfer_tag: resolveTransferTag(latestTransfer, order),
    transfer_status: order.transfer_status || '',
    transfer_round: Number(order.transfer_round || 0),
    current_responsible_user_id: order.current_responsible_user_id || order.rider_id || null,
    current_responsible_role: order.current_responsible_role || '',
    transfer_from_user_id: order.transfer_from_user_id || null,
    transfer_to_user_id: order.transfer_to_user_id || null,
    transfer_from_user: latestTransfer?.from_user || null,
    transfer_to_user: latestTransfer?.to_user || null,
    transfer_to_town: resolvedTransferTown,
    target_town_name: resolvedTransferTown,
    transfer_last_action_at: order.transfer_last_action_at || null,
    transfer_last_action_type: order.transfer_last_action_type || '',
    transfer_revoke_used: Boolean(order.transfer_revoke_used),
    transfer_chain_summary: latestTransfer ? {
      latest_round: latestTransfer.transfer_round,
      latest_status: latestTransfer.is_revoked ? 'revoked' : 'transferred',
      latest_from_user: latestTransfer.from_user,
      latest_to_user: latestTransfer.to_user,
      latest_to_town: latestTransfer.to_town_name || resolvedTransferTown,
      latest_created_at: latestTransfer.created_at,
      latest_revoked_at: latestTransfer.revoked_at
    } : null,
    transfer_chain: transferChain,
    can_transfer: currentUser ? canRiderTransferOrder(currentUser, order) : false,
    can_transfer_revoke: currentUser ? canRiderRevokeTransfer(currentUser, order, latestTransfer) : false,
    can_transfer_to_town_rider: currentUser ? canTownDispatcherTransferToRider(currentUser, order) : false,
    can_transfer_to_town_rider_revoke: currentUser ? canTownDispatcherRevokeTransferToRider(currentUser, order, latestTransfer) : false
  };
};

const appendTransferMetaToOrder = ({ plain, currentUser, transferChain = [] }) => {
  return {
    ...plain,
    ...buildOrderTransferMeta({ order: plain, currentUser, transferChain })
  };
};

const resolveCustomerTownName = ({ customerTown, addressPayload, merchant }) => {
  const townName =
    normalizeTownName(customerTown) ||
    normalizeTownName(addressPayload?.town) ||
    normalizeTownName(addressPayload?.street) ||
    normalizeTownName(addressPayload?.district);

  if (townName) {
    return townName;
  }

  if (merchant?.business_scope === 'town_food') {
    return normalizeTownName(merchant.town_name);
  }

  return '';
};

const resolveCustomerTownCode = ({ customerTownCode, addressPayload, merchant }) => {
  const townCode = String(
    customerTownCode ??
    addressPayload?.town_code ??
    addressPayload?.townCode ??
    ''
  ).trim();

  if (townCode) {
    return townCode;
  }

  if (merchant?.business_scope === 'town_food') {
    return String(merchant.town_code || '').trim();
  }

  return '';
};

const resolveTownAreaByCoordinates = async ({ customerLng, customerLat }) => {
  if (!Number.isFinite(customerLng) || !Number.isFinite(customerLat)) {
    return null;
  }

  return resolveAreaByCoordinate({
    lng: customerLng,
    lat: customerLat,
    areaType: 'town'
  });
};

const ensureTownScopeConsistency = ({
  merchant,
  resolvedOrderType,
  resolvedCustomerTown,
  resolvedCustomerTownCode,
  resolvedArea
}) => {
  if (resolvedOrderType !== 'town') {
    return;
  }

  const merchantTownCode = String(merchant?.town_code || '').trim();
  const merchantTownName = normalizeTownName(merchant?.town_name);
  const customerTownName = normalizeTownName(resolvedCustomerTown);
  const areaTownCode = String(resolvedArea?.area_code || '').trim();
  const areaTownName = normalizeTownName(resolvedArea?.area_name);

  if (!merchantTownCode || !merchantTownName) {
    const error = new Error('当前镇上商家未绑定所属乡镇，请联系平台处理');
    error.statusCode = 400;
    throw error;
  }

  if (!resolvedCustomerTownCode) {
    const error = new Error('未识别到当前所属乡镇，请开启定位或手动选择乡镇');
    error.statusCode = 400;
    throw error;
  }

  if (merchantTownCode !== resolvedCustomerTownCode) {
    const error = new Error('当前仅支持浏览和下单所属乡镇的商家');
    error.statusCode = 400;
    throw error;
  }

  if (resolvedArea && areaTownCode && merchantTownCode !== areaTownCode) {
    const error = new Error('定位识别的乡镇与店铺乡镇不一致，禁止跨乡镇下单');
    error.statusCode = 400;
    throw error;
  }

  if (customerTownName && merchantTownName !== customerTownName) {
    const error = new Error('当前仅支持本乡镇下单，请切换到所属乡镇后再试');
    error.statusCode = 400;
    throw error;
  }

  if (resolvedArea && areaTownName && customerTownName && areaTownName !== customerTownName) {
    const error = new Error('定位乡镇与所选乡镇不一致，请确认后重试');
    error.statusCode = 400;
    throw error;
  }
};

const resolveOrderTypeByMerchant = (merchant, requestedOrderType) => {
  if (merchant?.business_scope === 'town_food') {
    return 'town';
  }

  if (merchant?.business_scope === 'county_food') {
    return 'county';
  }

  return requestedOrderType === 'town' ? 'town' : 'county';
};

const isCrossTownTakeout = (merchant, customerTown) => {
  const merchantTown = normalizeTownName(merchant?.town_name);
  const resolvedCustomerTown = normalizeTownName(customerTown);
  return Boolean(merchantTown && resolvedCustomerTown && merchantTown !== resolvedCustomerTown);
};

const hasValidRouteCoordinatePair = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const isRouteTimeoutError = (error) => {
  const message = String(error?.message || '');
  return (
    error?.statusCode === 502 &&
    (
      message.includes('timeout of') ||
      message.includes('ECONNABORTED') ||
      message.includes('腾讯地图驾车路线请求失败')
    )
  );
};

const estimateDeliveryFeeByLineDistance = ({
  merchant,
  resolvedOrderType,
  customerLng,
  customerLat
}) => {
  ensureMerchantRouteCoordinates(merchant);
  const merchantLat = Number(merchant.latitude);
  const merchantLng = Number(merchant.longitude);
  const distanceKm = calculateDistance(merchantLat, merchantLng, Number(customerLat), Number(customerLng));

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    const error = new Error('配送距离估算失败，请稍后重试');
    error.statusCode = 502;
    throw error;
  }

  const deliveryFee = computeDeliveryFee({
    distanceKm,
    orderType: resolvedOrderType === 'town' ? 'town' : 'county'
  });

  if (deliveryFee === null) {
    const error = new Error('配送费估算失败，请稍后重试');
    error.statusCode = 502;
    throw error;
  }

  return {
    deliveryFee,
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    calculationMode: 'line_distance_fallback'
  };
};

const ensureMerchantRouteCoordinates = (merchant) => {
  const latitude = Number(merchant?.latitude);
  const longitude = Number(merchant?.longitude);
  if (hasValidRouteCoordinatePair(latitude, longitude)) {
    return;
  }

  const error = new Error(`商家“${merchant?.name || '未知商家'}”未设置有效地图坐标，请先在商家资料中重新地图选点`);
  error.statusCode = 400;
  throw error;
};

const estimateTownRouteDeliveryFee = async ({ merchant, customerLng, customerLat }) => {
  ensureMerchantRouteCoordinates(merchant);
  const routeSummary = await routePlanningService.getDrivingDistanceKm({
    startLng: merchant.longitude,
    startLat: merchant.latitude,
    endLng: customerLng,
    endLat: customerLat,
    context: {
      scene: 'town_delivery_fee',
      merchant_id: merchant?.id || null,
      merchant_name: merchant?.name || null,
      merchant_town: merchant?.town_name || null
    }
  });

  const deliveryFee = computeDeliveryFee({
    distanceKm: routeSummary.distanceKm,
    orderType: 'town'
  });

  if (deliveryFee === null) {
    const error = new Error('乡镇配送费计算失败');
    error.statusCode = 500;
    throw error;
  }

  return {
    distanceKm: routeSummary.distanceKm,
    deliveryFee
  };
};

const estimateCountyRouteDeliveryFee = async ({ merchant, customerLng, customerLat }) => {
  ensureMerchantRouteCoordinates(merchant);
  const routeSummary = await routePlanningService.getDrivingDistanceKm({
    startLng: merchant.longitude,
    startLat: merchant.latitude,
    endLng: customerLng,
    endLat: customerLat,
    context: {
      scene: 'county_delivery_fee',
      merchant_id: merchant?.id || null,
      merchant_name: merchant?.name || null,
      merchant_town: merchant?.town_name || null,
      merchant_scope: merchant?.business_scope || null
    }
  });

  const deliveryFee = computeDeliveryFee({
    distanceKm: routeSummary.distanceKm,
    orderType: 'county'
  });

  if (deliveryFee === null) {
    const error = new Error('县城美食配送费计算失败');
    error.statusCode = 500;
    throw error;
  }

  return {
    distanceKm: routeSummary.distanceKm,
    deliveryFee
  };
};

const estimateDeliveryFeeByContext = async ({
  merchant,
  resolvedOrderType,
  resolvedCustomerTown,
  deliveryType,
  customerLng,
  customerLat
}) => {
  if (Number(deliveryType) !== 1) {
    return {
      deliveryFee: 0,
      distanceKm: null,
      calculationMode: 'pickup'
    };
  }

  if (resolvedOrderType === 'town') {
    if (isCrossTownTakeout(merchant, resolvedCustomerTown)) {
      const error = new Error('当前仅支持本乡镇下单，禁止跨乡镇配送');
      error.statusCode = 400;
      throw error;
    }

    const routeResult = await estimateTownRouteDeliveryFee({
      merchant,
      customerLng,
      customerLat
    });

    return {
      deliveryFee: routeResult.deliveryFee,
      distanceKm: routeResult.distanceKm,
      calculationMode: 'tencent_drive_route'
    };
  }

  const routeResult = await estimateCountyRouteDeliveryFee({
    merchant,
    customerLng,
    customerLat
  });

  return {
    deliveryFee: routeResult.deliveryFee,
    distanceKm: routeResult.distanceKm,
    calculationMode: 'tencent_drive_route'
  };
};

const estimateDeliveryFeeWithFallback = async ({
  merchant,
  resolvedOrderType,
  resolvedCustomerTown,
  deliveryType,
  customerLng,
  customerLat
}) => {
  try {
    return await estimateDeliveryFeeByContext({
      merchant,
      resolvedOrderType,
      resolvedCustomerTown,
      deliveryType,
      customerLng,
      customerLat
    });
  } catch (error) {
    if (!isRouteTimeoutError(error)) {
      throw error;
    }

    console.warn('[DeliveryFeeFallback] tencent route timeout, fallback to line distance', {
      merchant_id: merchant?.id || null,
      merchant_name: merchant?.name || null,
      order_type: resolvedOrderType,
      customer_town: resolvedCustomerTown || null
    });

    return estimateDeliveryFeeByLineDistance({
      merchant,
      resolvedOrderType,
      customerLng,
      customerLat
    });
  }
};

const normalizeSpecText = (value) => String(value || '').trim();

const isSupermarketMerchant = (merchant) =>
  normalizeMerchantCategory(merchant?.category) === SUPERMARKET_CATEGORY;

const resolveMerchantSupermarketDeliveryPermission = (merchant) =>
  normalizeSupermarketDeliveryPermission(merchant?.supermarket_delivery_permission);

const resolveOrderSupermarketDeliveryMode = (order) =>
  normalizeSupermarketDeliveryMode(order?.supermarket_delivery_mode);

const resolveMerchantEffectiveDeliveryPermission = async (merchant) => {
  const explicitPermission = resolveMerchantSupermarketDeliveryPermission(merchant);
  if (explicitPermission) {
    return explicitPermission;
  }

  const merchantId = Number(merchant?.id || 0);
  if (!merchantId) {
    return null;
  }

  const approvedMerchantDeliveryCount = await User.count({
    where: {
      role: MERCHANT_DELIVERY_ROLE,
      bound_merchant_id: merchantId,
      status: 1,
      rider_audit_status: 1
    }
  });

  return approvedMerchantDeliveryCount > 0
    ? SUPERMARKET_DELIVERY_PERMISSIONS.SELF_ONLY
    : null;
};

const repairOrderDeliveryFieldsIfNeeded = async (order, merchant) => {
  if (!order) {
    return { permission: null, mode: null };
  }

  const currentPermission = normalizeSupermarketDeliveryPermission(order.supermarket_delivery_permission_snapshot);
  const currentMode = resolveOrderSupermarketDeliveryMode(order);
  if (currentPermission && currentMode) {
    return { permission: currentPermission, mode: currentMode };
  }

  const effectivePermission = currentPermission || await resolveMerchantEffectiveDeliveryPermission(merchant);
  const effectiveMode = currentMode || (effectivePermission
    ? resolveInitialSupermarketDeliveryMode(effectivePermission)
    : null);

  if (!effectivePermission && !effectiveMode) {
    return {
      permission: currentPermission || null,
      mode: currentMode || null
    };
  }

  const patch = {};
  if (!currentPermission && effectivePermission) {
    patch.supermarket_delivery_permission_snapshot = effectivePermission;
  }
  if (!currentMode && effectiveMode) {
    patch.supermarket_delivery_mode = effectiveMode;
    patch.settlement_rule_snapshot = resolveSettlementRuleSnapshotByMode(effectiveMode);
    Object.assign(patch, buildTakeoutSettlementPatch({
      ...order.get({ plain: true }),
      supermarket_delivery_mode: effectiveMode
    }));
  }

  if (Object.keys(patch).length > 0) {
    await order.update(patch);
    await order.reload();
  }

  return {
    permission: normalizeSupermarketDeliveryPermission(order.supermarket_delivery_permission_snapshot) || effectivePermission || null,
    mode: resolveOrderSupermarketDeliveryMode(order) || effectiveMode || null
  };
};

const buildTakeoutSettlementPatch = (order) => {
  const settlement = computeTakeoutSettlement(order);
  return {
    pay_amount: settlement.payAmount,
    rider_fee: settlement.riderFee,
    commission_amount: settlement.commissionAmount,
    rider_incentive_amount: settlement.riderIncentiveAmount,
    platform_income_amount: settlement.platformIncomeAmount,
    merchant_income_amount: settlement.merchantIncomeAmount,
    settlement_rule_snapshot: settlement.settlementRule || SUPERMARKET_SETTLEMENT_RULES.DEFAULT
  };
};

const resolveSettlementRuleSnapshotByMode = (mode) => {
  switch (mode) {
    case SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY:
      return SUPERMARKET_SETTLEMENT_RULES.SELF_DELIVERY_FIXED;
    case SUPERMARKET_DELIVERY_MODES.RIDER_DELIVERY:
      return SUPERMARKET_SETTLEMENT_RULES.RIDER_DELIVERY_FIXED;
    case SUPERMARKET_DELIVERY_MODES.PENDING:
      return SUPERMARKET_SETTLEMENT_RULES.HYBRID_PENDING;
    default:
      return SUPERMARKET_SETTLEMENT_RULES.DEFAULT;
  }
};

const parseOrderItems = (productsInfo) => {
  if (Array.isArray(productsInfo)) {
    return productsInfo;
  }

  if (typeof productsInfo === 'string') {
    try {
      const parsed = JSON.parse(productsInfo);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  return null;
};

const parseCountyGroupShops = (shops) => {
  if (Array.isArray(shops)) {
    return shops;
  }
  if (typeof shops !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(shops);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

const normalizeReviewScore = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return null;
  }
  return score;
};

const normalizeReviewText = (value, maxLength = 500) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
};

const normalizeReviewImages = (value) => {
  let images = [];
  if (Array.isArray(value)) {
    images = value;
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      images = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      images = [];
    }
  }

  return images
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3);
};

const parseStoredReviewImages = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const attachOrderReviewMeta = (order) => {
  const plain = typeof order?.get === 'function' ? order.get({ plain: true }) : { ...order };
  const review = plain.review || null;
  return {
    ...plain,
    has_review: Boolean(review),
    review_id: review?.id || null,
    merchant_score: review?.merchant_score ?? null,
    rider_score: review?.rider_score ?? null
  };
};

const USER_HIDE_ALLOWED_ORDER_STATUSES = new Set([6, 7]);
const ACTIVE_REFUND_STATUSES = new Set([0, 1]);
const USER_HIDE_BATCH_LIMIT = 50;

const normalizeOrderIdList = (rawValue) => {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const item of rawValue) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
};

const getHideBlockedReasonByStatus = (status) => {
  if (USER_HIDE_ALLOWED_ORDER_STATUSES.has(Number(status))) {
    return '';
  }
  return '当前订单未完结，暂不能移出列表';
};

const resolveCountyGroupCustomerTown = ({ customerTown, addressPayload }) => {
  return (
    normalizeTownName(customerTown) ||
    normalizeTownName(addressPayload?.town) ||
    normalizeTownName(addressPayload?.street) ||
    normalizeTownName(addressPayload?.district) ||
    ''
  );
};

const buildAddressSummary = (deliveryAddress) => {
  return String(deliveryAddress || '未填写地址').slice(0, 200);
};

const GAODE_SEARCH_TEXT_MAX_LENGTH = 48;
const ADDRESS_SPLIT_REGEX = /[，,；;|\\/]/;
const MOBILE_PHONE_REGEX = /1\d{10}/g;
const COORDINATE_TEXT_REGEX = /\b\d{2,3}\.\d{4,}\s*,\s*\d{2,3}\.\d{4,}\b/g;
const ADDRESS_LABEL_NOISE_REGEX = /(收货人|联系人|联系电话|电话|手机|手机号|收件人|姓名|备注|经度|纬度|longitude|latitude|lng|lat|poi_name|formatted_address|location_summary|search_text|coord_text|nearby_hint|original_address|source|confidence)\s*[:：=]\s*[^，,；;|]+/gi;
const ADDRESS_STRUCTURE_PATTERNS = [
  { type: 'region', regex: /[\u4e00-\u9fa5A-Za-z0-9]{1,16}(?:县|区)/g },
  { type: 'town', regex: /[\u4e00-\u9fa5A-Za-z0-9]{1,16}(?:乡|镇|街道|办事处)/g },
  { type: 'village', regex: /[\u4e00-\u9fa5A-Za-z0-9]{1,24}(?:村|社区|组|屯|队|庄|寨)/g },
  { type: 'road', regex: /[\u4e00-\u9fa5A-Za-z0-9]{1,24}(?:路|街|大道|大街|公路|巷|胡同|道)/g },
  { type: 'detail', regex: /[\u4e00-\u9fa5A-Za-z0-9]{1,24}(?:号|栋|幢|单元|室|楼|院|广场|学校|医院|小区|市场|门口|东门|西门|南门|北门)/g }
];

const normalizeLocationFragment = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/NaN/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizeGaodeSearchFragment = (value) => {
  const normalized = normalizeLocationFragment(value);
  if (!normalized || normalized === '未填写地址') {
    return '';
  }

  return normalized
    .replace(COORDINATE_TEXT_REGEX, ' ')
    .replace(MOBILE_PHONE_REGEX, ' ')
    .replace(ADDRESS_LABEL_NOISE_REGEX, ' ')
    .replace(/["'`{}\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const appendUniqueFragments = (list, value) => {
  const normalized = sanitizeGaodeSearchFragment(value);
  if (!normalized) {
    return;
  }
  const existingIndex = list.findIndex((item) => item === normalized || item.includes(normalized) || normalized.includes(item));
  if (existingIndex === -1) {
    list.push(normalized);
    return;
  }

  const existing = list[existingIndex];
  if (normalized.length > existing.length && normalized.includes(existing)) {
    list.splice(existingIndex, 1, normalized);
  }
};

const createAddressBuckets = () => ({
  region: [],
  town: [],
  village: [],
  road: [],
  detail: []
});

const pushFragmentToBucket = (buckets, type, value) => {
  if (!buckets[type]) {
    return;
  }
  appendUniqueFragments(buckets[type], value);
};

const classifyAddressFragment = (fragment = '') => {
  if (!fragment) {
    return '';
  }
  if (/(?:乡|镇|街道|办事处)$/.test(fragment)) {
    return 'town';
  }
  if (/(?:村|社区|组|屯|队|庄|寨)$/.test(fragment)) {
    return 'village';
  }
  if (/(?:路|街|大道|大街|公路|巷|胡同|道)$/.test(fragment)) {
    return 'road';
  }
  if (/(?:县|区)$/.test(fragment)) {
    return 'region';
  }
  if (/(?:号|栋|幢|单元|室|楼|院|广场|学校|医院|小区|市场|门口|东门|西门|南门|北门)$/.test(fragment)) {
    return 'detail';
  }
  return 'detail';
};

const extractAddressFragmentsFromText = (value) => {
  const text = sanitizeGaodeSearchFragment(value);
  if (!text) {
    return [];
  }

  const matches = [];
  ADDRESS_STRUCTURE_PATTERNS.forEach(({ type, regex }) => {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const token = sanitizeGaodeSearchFragment(match[0]);
      if (!token) {
        continue;
      }
      matches.push({
        type,
        token,
        index: match.index ?? 0
      });
    }
  });

  if (!matches.length) {
    return [];
  }

  return matches
    .sort((a, b) => a.index - b.index || a.token.length - b.token.length)
    .reduce((acc, item) => {
      const duplicated = acc.some(
        (existing) =>
          existing.token === item.token ||
          existing.token.includes(item.token) ||
          item.token.includes(existing.token)
      );
      if (!duplicated) {
        acc.push(item);
      }
      return acc;
    }, []);
};

const appendTextAddressParts = (buckets, value) => {
  const text = sanitizeGaodeSearchFragment(value);
  if (!text) {
    return;
  }

  const segments = text
    .split(ADDRESS_SPLIT_REGEX)
    .map((item) => sanitizeGaodeSearchFragment(item))
    .filter(Boolean);
  const sourceSegments = segments.length ? segments : [text];

  sourceSegments.forEach((segment) => {
    const extracted = extractAddressFragmentsFromText(segment);
    if (extracted.length) {
      extracted.forEach(({ type, token }) => pushFragmentToBucket(buckets, type, token));
      return;
    }
    pushFragmentToBucket(buckets, classifyAddressFragment(segment), segment);
  });
};

const appendAddressLikeParts = (buckets, payload) => {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  [
    payload.district,
    payload.county,
    payload.area,
    payload.county_name
  ].forEach((value) => pushFragmentToBucket(buckets, 'region', value));

  [
    payload.town,
    payload.township,
    payload.town_name,
    payload.streetTown,
    payload.subdistrict
  ].forEach((value) => pushFragmentToBucket(buckets, 'town', value));

  [
    payload.village,
    payload.village_name,
    payload.community,
    payload.community_name,
    payload.group,
    payload.hamlet,
    payload.name
  ].forEach((value) => {
    const normalized = sanitizeGaodeSearchFragment(value);
    if (!normalized) {
      return;
    }
    if (/(?:村|社区|组|屯|队|庄|寨)$/.test(normalized)) {
      pushFragmentToBucket(buckets, 'village', normalized);
    }
  });

  [
    payload.road,
    payload.road_name,
    payload.street,
    payload.street_name
  ].forEach((value) => pushFragmentToBucket(buckets, 'road', value));

  [
    payload.address,
    payload.detail,
    payload.name
  ].forEach((value) => appendTextAddressParts(buckets, value));
};

const buildOrderedAddressText = (buckets) => {
  const parts = [];
  buckets.region.slice(0, 1).forEach((item) => appendUniqueFragments(parts, item));
  buckets.town.slice(0, 1).forEach((item) => appendUniqueFragments(parts, item));
  buckets.village.slice(0, 1).forEach((item) => appendUniqueFragments(parts, item));

  if (!buckets.village.length) {
    buckets.road.slice(0, 1).forEach((item) => appendUniqueFragments(parts, item));
  }

  if (!buckets.village.length && !buckets.road.length) {
    buckets.detail
      .filter((item) => !/附近$/.test(item))
      .slice(0, 1)
      .forEach((item) => appendUniqueFragments(parts, item));
  }

  const result = parts.join('');
  if (!result) {
    return '';
  }
  return result.length > GAODE_SEARCH_TEXT_MAX_LENGTH
    ? result.slice(0, GAODE_SEARCH_TEXT_MAX_LENGTH)
    : result;
};

const resolvePrimaryAddressText = ({ payload, reverseContext, candidates = [] }) => {
  const buckets = createAddressBuckets();

  if (payload && typeof payload === 'object') {
    appendAddressLikeParts(buckets, payload);
  }

  candidates.forEach((candidate) => appendTextAddressParts(buckets, candidate));

  if (!buckets.town.length) {
    pushFragmentToBucket(buckets, 'town', reverseContext?.town_name);
  }
  if (!buckets.road.length) {
    pushFragmentToBucket(buckets, 'road', reverseContext?.road_name || reverseContext?.street_name);
  }
  if (!buckets.region.length) {
    pushFragmentToBucket(buckets, 'region', reverseContext?.county_name);
  }

  return buildOrderedAddressText(buckets);
};

const resolveNearbyHintText = (reverseContext = {}, primaryAddress = '') => {
  const primary = sanitizeGaodeSearchFragment(primaryAddress);
  const parts = [];
  appendUniqueFragments(parts, reverseContext?.poi_name ? `${reverseContext.poi_name}附近` : '');
  appendUniqueFragments(parts, reverseContext?.road_name || reverseContext?.street_name);
  appendUniqueFragments(parts, reverseContext?.location_summary);
  appendUniqueFragments(parts, reverseContext?.formatted_address);

  const filtered = parts.filter((item) => {
    if (!primary) {
      return true;
    }
    return !primary.includes(item) && !item.includes(primary);
  });

  return filtered[0] || '';
};

const buildDeliveryAddressText = (deliveryAddress) => {
  const directPayload = parseAddressPayload(deliveryAddress);
  if (directPayload && typeof directPayload === 'object') {
    const buckets = createAddressBuckets();
    appendAddressLikeParts(buckets, directPayload);
    const structuredText = buildOrderedAddressText(buckets);
    if (structuredText) {
      return structuredText;
    }
  }

  const normalizedText = sanitizeGaodeSearchFragment(deliveryAddress);
  if (!normalizedText || (!normalizedText.startsWith('{') && !normalizedText.startsWith('['))) {
    return normalizedText;
  }

  try {
    const genericPayload = JSON.parse(normalizedText);
    const buckets = createAddressBuckets();
    appendAddressLikeParts(buckets, genericPayload);
    return buildOrderedAddressText(buckets) || '';
  } catch (error) {
    return '';
  }
};

const buildGaodeSearchAssist = async (order) => {
  return null;
};

const normalizeCountyGroupShopInput = (shop = {}, index = 0) => {
  const merchantId = Number(shop.merchant_id ?? shop.merchantId);
  const productsInfo =
    shop.products_info ?? shop.productsInfo ?? shop.items ?? shop.order_items ?? shop.orderItems;
  const parsedItems = parseOrderItems(productsInfo);
  const totalAmount = round2(shop.total_amount ?? shop.totalAmount ?? shop.goods_amount ?? shop.goodsAmount);
  const packageFee = round2(shop.package_fee ?? shop.packageFee);
  const discountAmount = round2(shop.discount_amount ?? shop.discountAmount);

  if (!Number.isInteger(merchantId) || merchantId <= 0) {
    return { error: `第${index + 1}个店铺缺少 merchant_id` };
  }
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    return { error: `第${index + 1}个店铺商品明细不能为空` };
  }
  if (totalAmount <= 0) {
    return { error: `第${index + 1}个店铺商品金额不正确` };
  }

  return {
    merchantId,
    productsInfo: parsedItems,
    totalAmount,
    packageFee,
    discountAmount
  };
};

const estimateCountyGroupOrderSummary = async ({
  shops,
  customerLng,
  customerLat
}) => {
  const rawShops = parseCountyGroupShops(shops);
  if (!Array.isArray(rawShops) || rawShops.length === 0) {
    const error = new Error('缺少 shops，无法进行多店结算');
    error.statusCode = 400;
    throw error;
  }

  const normalizedShops = [];
  for (let i = 0; i < rawShops.length; i += 1) {
    const normalizedShop = normalizeCountyGroupShopInput(rawShops[i], i);
    if (normalizedShop.error) {
      const error = new Error(normalizedShop.error);
      error.statusCode = 400;
      throw error;
    }
    normalizedShops.push(normalizedShop);
  }

  const merchantIds = [...new Set(normalizedShops.map((shop) => shop.merchantId))];
  const merchants = await Merchant.findAll({
    where: {
      id: { [Op.in]: merchantIds }
    }
  });
  if (merchants.length !== merchantIds.length) {
    const error = new Error('存在无效商家，请刷新后重试');
    error.statusCode = 400;
    throw error;
  }

  const merchantMap = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const shopSummaries = [];
  for (const shop of normalizedShops) {
    const merchant = merchantMap.get(shop.merchantId);
    if (!merchant) {
      const error = new Error('商家不存在');
      error.statusCode = 404;
      throw error;
    }
    if (merchant.status !== 1 || Number(merchant.audit_status) !== 1) {
      const error = new Error(`商家“${merchant.name}”当前不可下单`);
      error.statusCode = 400;
      throw error;
    }
    if (merchant.business_scope !== 'county_food') {
      const error = new Error(`商家“${merchant.name}”不支持县城美食拼单`);
      error.statusCode = 400;
      throw error;
    }

    let normalizedProductsInfo = shop.productsInfo;
    if (isSupermarketMerchant(merchant)) {
      const normalizedResult = await normalizeSupermarketOrderItems({
        merchantId: merchant.id,
        items: shop.productsInfo
      });
      if (normalizedResult.error) {
        const error = new Error(normalizedResult.error);
        error.statusCode = 400;
        throw error;
      }
      normalizedProductsInfo = normalizedResult.items;
    }

    let routeResult;
    try {
      routeResult = await estimateCountyRouteDeliveryFee({
        merchant,
        customerLng,
        customerLat
      });
    } catch (error) {
      if (!isRouteTimeoutError(error)) {
        throw error;
      }
      console.warn('[CountyGroupDeliveryFeeFallback] tencent route timeout, fallback to line distance', {
        merchant_id: merchant?.id || null,
        merchant_name: merchant?.name || null
      });
      routeResult = estimateDeliveryFeeByLineDistance({
        merchant,
        resolvedOrderType: 'county',
        customerLng,
        customerLat
      });
    }

    shopSummaries.push({
      merchant,
      merchantId: merchant.id,
      merchantName: merchant.name,
      productsInfo: normalizedProductsInfo,
      totalAmount: shop.totalAmount,
      packageFee: shop.packageFee,
      discountAmount: shop.discountAmount,
      baseDeliveryFee: routeResult.deliveryFee,
      routeDistanceKm: routeResult.distanceKm,
      appliedDeliveryFee: 0,
      isMainStore: false
    });
  }

  let mainShop = shopSummaries[0];
  for (const shop of shopSummaries.slice(1)) {
    if (shop.baseDeliveryFee > mainShop.baseDeliveryFee) {
      mainShop = shop;
    }
  }

  let goodsAmount = 0;
  let packageFee = 0;
  let discountAmount = 0;
  let deliveryFee = 0;
  const summarizedShops = shopSummaries.map((shop) => {
    const isMainStore = shop.merchantId === mainShop.merchantId;
    const appliedDeliveryFee = isMainStore ? shop.baseDeliveryFee : COUNTY_GROUP_EXTRA_STORE_FEE;
    goodsAmount += round2(shop.totalAmount);
    packageFee += round2(shop.packageFee);
    discountAmount += round2(shop.discountAmount);
    deliveryFee += round2(appliedDeliveryFee);

    return {
      ...shop,
      isMainStore,
      appliedDeliveryFee
    };
  });

  return {
    shops: summarizedShops,
    mainMerchantId: mainShop.merchantId,
    storeCount: summarizedShops.length,
    goodsAmount: round2(goodsAmount),
    packageFee: round2(packageFee),
    discountAmount: round2(discountAmount),
    deliveryFee: round2(deliveryFee),
    payAmount: round2(goodsAmount + packageFee + deliveryFee - discountAmount)
  };
};

const resolveOrderItemProductId = (item = {}) => {
  const candidates = [item.product_id, item.productId, item.id, item.food_id, item.foodId];
  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isInteger(num) && num > 0) {
      return num;
    }
  }
  return null;
};

const resolveSelectedSpec = (item = {}) =>
  normalizeSpecText(
    item.selected_spec ??
      item.selectedSpec ??
      item.spec_value ??
      item.specValue ??
      item.spec
  );

const normalizeSupermarketOrderItems = async ({ merchantId, items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: '超市商品下单失败：商品明细不能为空' };
  }

  const productIds = [];
  for (const item of items) {
    const productId = resolveOrderItemProductId(item);
    if (!productId) {
      return { error: '超市商品下单失败：存在缺少商品ID的明细' };
    }
    productIds.push(productId);
  }

  const products = await Product.findAll({
    where: {
      merchant_id: merchantId,
      id: { [Op.in]: productIds }
    }
  });

  if (products.length !== new Set(productIds).size) {
    return { error: '超市商品下单失败：存在无效商品，请刷新后重试' };
  }

  const specs = await ProductSpec.findAll({
    where: {
      product_id: { [Op.in]: productIds },
      status: 1
    },
    order: [['sort', 'ASC'], ['id', 'ASC']]
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const specMap = new Map();
  specs.forEach((spec) => {
    const bucket = specMap.get(spec.product_id) || {
      groupName: '',
      options: []
    };
    if (!bucket.groupName) {
      bucket.groupName = spec.group_name || '';
    }
    bucket.options.push(spec.name);
    specMap.set(spec.product_id, bucket);
  });

  const normalizedItems = items.map((item) => {
    const productId = resolveOrderItemProductId(item);
    const product = productMap.get(productId);
    const productSpec = specMap.get(productId);
    const selectedSpec = resolveSelectedSpec(item);

    if (productSpec?.options?.length) {
      if (!selectedSpec) {
        throw new Error(`商品“${product.name}”请选择${productSpec.groupName || '规格'}`);
      }
      if (!productSpec.options.includes(selectedSpec)) {
        throw new Error(`商品“${product.name}”所选${productSpec.groupName || '规格'}不存在`);
      }

      return {
        ...item,
        product_id: productId,
        selected_spec: selectedSpec,
        spec_group_name: productSpec.groupName || '规格'
      };
    }

    const normalizedItem = {
      ...item,
      product_id: productId
    };
    delete normalizedItem.selected_spec;
    delete normalizedItem.selectedSpec;
    delete normalizedItem.spec_value;
    delete normalizedItem.specValue;
    delete normalizedItem.spec;
    delete normalizedItem.spec_group_name;

    return normalizedItem;
  });

  return { items: normalizedItems };
};

/**
 * 取一个 item 的购买数量（兼容 quantity / count / num / buy_count 等命名）
 */
const resolveOrderItemQuantity = (item = {}) => {
  const candidates = [
    item.quantity,
    item.count,
    item.num,
    item.buy_count,
    item.buyCount,
    item.qty
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isInteger(n) && n > 0) {
      return n;
    }
  }
  return null;
};

/**
 * 按数据库真实价格 + 规格加价重算外卖订单商品总金额
 * 用于阻止前端篡改 total_amount。
 * 返回 { goodsAmount } 或 { error } 或 { skipped: true }（解析不到商品 id 时降级）
 */
const recomputeTakeoutGoodsAmount = async ({ merchantId, items }) => {
  const list = parseOrderItems(items);
  if (!Array.isArray(list) || list.length === 0) {
    return { error: '商品明细不能为空' };
  }

  const productIds = [];
  for (const item of list) {
    const pid = resolveOrderItemProductId(item);
    if (!pid) {
      // 任意一行没有商品 ID，无法做真实重算 -> 直接拒绝，避免被绕过
      return { error: '商品明细缺少 product_id，无法核算金额' };
    }
    productIds.push(pid);
  }

  const products = await Product.findAll({
    where: {
      merchant_id: merchantId,
      id: { [Op.in]: productIds }
    }
  });
  if (products.length !== new Set(productIds).size) {
    return { error: '商品明细中存在无效或非本店商品' };
  }
  const productMap = new Map(products.map((p) => [Number(p.id), p]));

  const specs = await ProductSpec.findAll({
    where: {
      product_id: { [Op.in]: productIds },
      status: 1
    }
  });
  // 索引到 (product_id + spec_name) -> price_extra
  const specPriceMap = new Map();
  for (const spec of specs) {
    const key = `${spec.product_id}::${(spec.name || '').trim()}`;
    specPriceMap.set(key, Number(spec.price_extra || 0));
  }

  let goodsAmount = 0;
  for (const item of list) {
    const pid = resolveOrderItemProductId(item);
    const product = productMap.get(pid);
    if (!product) {
      return { error: '商品明细中存在无效商品' };
    }
    if (Number(product.status) !== 1) {
      return { error: `商品「${product.name}」已下架` };
    }

    const quantity = resolveOrderItemQuantity(item);
    if (!quantity) {
      return { error: `商品「${product.name}」数量不正确` };
    }

    const basePrice = Number(product.price || 0);
    const selectedSpec = resolveSelectedSpec(item);
    let extra = 0;
    if (selectedSpec) {
      const key = `${pid}::${selectedSpec}`;
      if (!specPriceMap.has(key)) {
        return { error: `商品「${product.name}」所选规格无效` };
      }
      extra = specPriceMap.get(key);
    }

    goodsAmount += round2(basePrice + extra) * quantity;
  }

  return { goodsAmount: round2(goodsAmount) };
};

// ==================== 用户端下单与支付区 ====================
/**
 * 创建订单（用户端）
 * 这里是用户下单的主入口，会做商品金额重算、配送费估算、乡镇归属校验、订单创建。
 */
exports.createOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      merchant_id,
      type = 'takeout',
      order_type,
      customer_town,
      customer_town_code,
      products_info,
      total_amount,
      delivery_fee = 0,
      package_fee = 0,
      discount_amount = 0,
      delivery_type = 1,
      contact_phone,
      contact_name,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      customer_lng,
      customer_lat,
      errand_type,
      errand_description,
      delivery_time_type,
      scheduled_delivery_at,
      deliveryTimeType,
      scheduledDeliveryAt,
      remark
    } = req.body;

    // 先拦下单必填参数。
    if (!merchant_id || !products_info || !total_amount) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }

    // 下单前先确认商家存在且已审核通过。
    const merchant = await Merchant.findByPk(merchant_id);
    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    if (merchant.status !== 1 || Number(merchant.audit_status) !== 1) {
      return res.status(400).json(errorResponse('商家当前不可下单'));
    }

    const supermarketDeliveryPermission = await resolveMerchantEffectiveDeliveryPermission(merchant);

    let normalizedProductsInfo = products_info;
    if (isSupermarketMerchant(merchant)) {
      const parsedItems = parseOrderItems(products_info);
      if (!parsedItems) {
        return res.status(400).json(errorResponse('超市商品下单失败：商品明细格式不正确'));
      }

      try {
        const normalizedResult = await normalizeSupermarketOrderItems({
          merchantId: merchant.id,
          items: parsedItems
        });

        if (normalizedResult.error) {
          return res.status(400).json(errorResponse(normalizedResult.error));
        }

        normalizedProductsInfo = normalizedResult.items;
      } catch (validationError) {
        return res.status(400).json(errorResponse(validationError.message || '超市商品规格校验失败'));
      }
    }

    // 这里一定要按数据库真实价格重算商品金额，防止前端篡改价格直接下单。
    let serverGoodsAmount = round2(total_amount);
    if (type === 'takeout') {
      const recomputed = await recomputeTakeoutGoodsAmount({
        merchantId: merchant.id,
        items: normalizedProductsInfo
      });
      if (recomputed.error) {
        return res.status(400).json(errorResponse(recomputed.error));
      }
      serverGoodsAmount = recomputed.goodsAmount;

      // 前端传来的金额必须和服务端重算结果对齐，差异超 1 分就拒绝下单。
      if (Math.abs(round2(total_amount) - serverGoodsAmount) > 0.01) {
        return res.status(400).json(errorResponse(
          `商品金额校验失败：前端 ${round2(total_amount)} 与服务端 ${serverGoodsAmount} 不一致，请刷新购物车重试`
        ));
      }
    }

    // 优惠金额不能为负，也不能超过商品金额，避免出现负总价。
    const safeDiscountAmount = Math.max(0, Math.min(round2(discount_amount), serverGoodsAmount));
    // 包装费也统一限制为非负值。
    const safePackageFee = Math.max(0, round2(package_fee));

    const { lng: finalCustomerLng, lat: finalCustomerLat, addressPayload } = resolveCustomerCoordinates(req.body);
    const resolvedOrderType = resolveOrderTypeByMerchant(merchant, order_type);
    const resolvedCustomerTown = resolveCustomerTownName({
      customerTown: customer_town,
      addressPayload,
      merchant
    });
    let resolvedCustomerTownCode = resolveCustomerTownCode({
      customerTownCode: customer_town_code,
      addressPayload,
      merchant
    });
    let resolvedArea = null;

    if (Number(delivery_type) === 1 && (finalCustomerLng === null || finalCustomerLat === null)) {
      return res.status(400).json(errorResponse('下单失败：缺少客户坐标，请重新选点'));
    }

    if (resolvedOrderType === 'town' && Number(delivery_type) === 1) {
      resolvedArea = await resolveTownAreaByCoordinates({
        customerLng: finalCustomerLng,
        customerLat: finalCustomerLat
      });
      if (resolvedArea) {
        resolvedCustomerTownCode = resolvedCustomerTownCode || resolvedArea.area_code;
      }
      ensureTownScopeConsistency({
        merchant,
        resolvedOrderType,
        resolvedCustomerTown,
        resolvedCustomerTownCode,
        resolvedArea
      });
    }

    const deliverySchedule = resolveDeliverySchedule({
      deliveryType: delivery_type,
      deliveryTimeType: delivery_time_type ?? deliveryTimeType,
      scheduledDeliveryAt: scheduled_delivery_at ?? scheduledDeliveryAt
    });
    if (deliverySchedule.error) {
      return res.status(400).json(errorResponse(deliverySchedule.error));
    }

    const deliveryEstimate = await estimateDeliveryFeeWithFallback({
      merchant,
      resolvedOrderType,
      resolvedCustomerTown,
      deliveryType: delivery_type,
      customerLng: finalCustomerLng,
      customerLat: finalCustomerLat
    });
    const computedDeliveryFee = deliveryEstimate.deliveryFee;

    const pay_amount = round2(serverGoodsAmount + computedDeliveryFee + safePackageFee - safeDiscountAmount);
    if (!(pay_amount > 0)) {
      return res.status(400).json(errorResponse('订单金额异常，请刷新后重试'));
    }
    const initialSupermarketDeliveryMode = supermarketDeliveryPermission
      ? resolveInitialSupermarketDeliveryMode(supermarketDeliveryPermission)
      : null;

    // 到这里参数和金额都通过了，才真正生成订单号并入库。
    const order_no = generateOrderNo();
    const items_json =
      typeof normalizedProductsInfo === 'object'
        ? JSON.stringify(normalizedProductsInfo)
        : (normalizedProductsInfo || '[]');
    const deliveryAddressStr =
      typeof delivery_address === 'object' ? JSON.stringify(delivery_address) : (delivery_address || '');
    const address = (deliveryAddressStr || '未填写地址').slice(0, 200);

    // 创建订单主记录。
    const order = await Order.create({
      order_no,
      order_id: order_no,
      user_id: user.id,
      merchant_id,
      type,
      order_type: resolvedOrderType,
      customer_town: resolvedCustomerTown,
      customer_town_code: resolvedCustomerTownCode || null,
      products_info: items_json,
      items_json,
      total_amount: serverGoodsAmount,
      delivery_fee: computedDeliveryFee,
      package_fee: safePackageFee,
      discount_amount: safeDiscountAmount,
      pay_amount,
      total_price: Number(pay_amount),
      delivery_type,
      delivery_time_type: deliverySchedule.deliveryTimeType,
      scheduled_delivery_at: deliverySchedule.scheduledDeliveryAt,
      supermarket_delivery_permission_snapshot: supermarketDeliveryPermission,
      supermarket_delivery_mode: initialSupermarketDeliveryMode,
      settlement_rule_snapshot: resolveSettlementRuleSnapshotByMode(initialSupermarketDeliveryMode),
      contact_phone: contact_phone || user.phone,
      contact_name: contact_name || user.nickname,
      delivery_address: deliveryAddressStr,
      address,
      delivery_latitude: finalCustomerLat,
      delivery_longitude: finalCustomerLng,
      customer_lng: finalCustomerLng,
      customer_lat: finalCustomerLat,
      merchant_lng: merchant.longitude, // 直接从商家表拿，不再信前端传的
      merchant_lat: merchant.latitude,
      errand_type,
      errand_description,
      remark,
      dispatch_center_status: resolvedOrderType === 'town' ? 'station_pending' : null,
      status: 0
    });
    const autoConfirmResult = await autoConfirmSingleOrderIfNeeded({
      order,
      userId: user.id,
      source: 'order.create'
    });
    const finalOrder = autoConfirmResult.order || order;
    console.log(`[order.create] user_id=${user.id} order_id=${finalOrder.id} merchant_id=${finalOrder.merchant_id} status=${finalOrder.status}`);

    if (merchant && merchant.user_id) {
      socketService.notifyMerchantNewOrder(merchant.user_id, finalOrder);
    }
    await socketService.broadcastDispatcherOrdersUpdate();

    res.status(201).json(successResponse(finalOrder, autoConfirmResult.enabled ? '订单创建成功（创建即已支付）' : '订单创建成功'));
  } catch (error) {
    next(error);
  }
};

exports.estimateDeliveryFee = async (req, res, next) => {
 * 估算配送费
 * 用户在下单前想知道配送费、配送距离、所属业务线时，通常会先走这里。
 */
exports.estimateDeliveryFee = async (req, res, next) => {
  try {
    const {
      merchant_id,
      order_type,
      customer_town,
      customer_town_code,
      delivery_type = 1,
      delivery_fee = 0
    } = req.body || {};

    if (!merchant_id) {
      return res.status(400).json(errorResponse('缺少 merchant_id'));
    }

    const merchant = await Merchant.findByPk(merchant_id);
    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    if (merchant.status !== 1 || Number(merchant.audit_status) !== 1) {
      return res.status(400).json(errorResponse('商家当前不可下单'));
    }

    const { lng: finalCustomerLng, lat: finalCustomerLat, addressPayload } = resolveCustomerCoordinates(req.body);
    const resolvedOrderType = resolveOrderTypeByMerchant(merchant, order_type);
    const resolvedCustomerTown = resolveCustomerTownName({
      customerTown: customer_town,
      addressPayload,
      merchant
    });
    let resolvedCustomerTownCode = resolveCustomerTownCode({
      customerTownCode: customer_town_code,
      addressPayload,
      merchant
    });
    let resolvedArea = null;

    if (Number(delivery_type) === 1 && (finalCustomerLng === null || finalCustomerLat === null)) {
      return res.status(400).json(errorResponse('缺少客户坐标，无法预估配送费'));
    }

    if (resolvedOrderType === 'town' && Number(delivery_type) === 1) {
      resolvedArea = await resolveTownAreaByCoordinates({
        customerLng: finalCustomerLng,
        customerLat: finalCustomerLat
      });
      if (resolvedArea) {
        resolvedCustomerTownCode = resolvedCustomerTownCode || resolvedArea.area_code;
      }
      ensureTownScopeConsistency({
        merchant,
        resolvedOrderType,
        resolvedCustomerTown,
        resolvedCustomerTownCode,
        resolvedArea
      });
    }

    const deliveryEstimate = await estimateDeliveryFeeWithFallback({
      merchant,
      resolvedOrderType,
      resolvedCustomerTown,
      deliveryType: delivery_type,
      customerLng: finalCustomerLng,
      customerLat: finalCustomerLat
    });

    res.json(successResponse({
      merchant_id: merchant.id,
      order_type: resolvedOrderType,
      customer_town: resolvedCustomerTown,
      customer_town_code: resolvedCustomerTownCode || null,
      delivery_type: Number(delivery_type),
      calculation_mode: deliveryEstimate.calculationMode,
      route_distance_km: deliveryEstimate.distanceKm,
      delivery_fee: deliveryEstimate.deliveryFee,
      resolved_town_area: resolvedArea
    }, '配送费预估成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 县城拼单费用预估
 * 这个接口专门给县城拼单场景使用，先算拼单总价和拆分结果。
 */
exports.estimateCountyGroupOrder = async (req, res, next) => {
  try {
    const { customer_town, delivery_type = 1 } = req.body || {};
    if (Number(delivery_type) !== 1) {
      return res.status(400).json(errorResponse('县城美食拼单暂不支持自取'));
    }

    const { lng: finalCustomerLng, lat: finalCustomerLat, addressPayload } = resolveCustomerCoordinates(req.body);
    if (finalCustomerLng === null || finalCustomerLat === null) {
      return res.status(400).json(errorResponse('缺少客户坐标，无法预估拼单配送费'));
    }

    const customerTown = resolveCountyGroupCustomerTown({
      customerTown: customer_town,
      addressPayload
    });
    const summary = await estimateCountyGroupOrderSummary({
      shops: req.body?.shops,
      customerLng: finalCustomerLng,
      customerLat: finalCustomerLat
    });

    res.json(successResponse({
      order_type: 'county',
      customer_town: customerTown,
      delivery_type: 1,
      main_merchant_id: summary.mainMerchantId,
      store_count: summary.storeCount,
      total_amount: summary.goodsAmount,
      package_fee: summary.packageFee,
      discount_amount: summary.discountAmount,
      delivery_fee: summary.deliveryFee,
      pay_amount: summary.payAmount,
      shops: summary.shops.map((shop) => ({
        merchant_id: shop.merchantId,
        merchant_name: shop.merchantName,
        total_amount: shop.totalAmount,
        package_fee: shop.packageFee,
        discount_amount: shop.discountAmount,
        route_distance_km: shop.routeDistanceKm,
        base_delivery_fee: shop.baseDeliveryFee,
        applied_delivery_fee: shop.appliedDeliveryFee,
        is_main_store: shop.isMainStore,
        products_info: shop.productsInfo
      }))
    }, '县城美食多店配送费预估成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建县城拼单订单
 * 和普通下单类似，但这里会一次性创建拼单组和多笔子订单。
 */
exports.createCountyGroupOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      customer_town,
      delivery_type = 1,
      contact_phone,
      contact_name,
      delivery_address,
      remark
    } = req.body || {};

    if (Number(delivery_type) !== 1) {
      return res.status(400).json(errorResponse('县城美食拼单暂不支持自取'));
    }

    const { lng: finalCustomerLng, lat: finalCustomerLat, addressPayload } = resolveCustomerCoordinates(req.body);
    if (finalCustomerLng === null || finalCustomerLat === null) {
      return res.status(400).json(errorResponse('缺少客户坐标，请重新选点'));
    }

    const customerTown = resolveCountyGroupCustomerTown({
      customerTown: customer_town,
      addressPayload
    });
    const summary = await estimateCountyGroupOrderSummary({
      shops: req.body?.shops,
      customerLng: finalCustomerLng,
      customerLat: finalCustomerLat
    });

    const deliveryAddressStr =
      typeof delivery_address === 'object' ? JSON.stringify(delivery_address) : (delivery_address || '');
    const address = buildAddressSummary(deliveryAddressStr);

    const created = await sequelize.transaction(async (t) => {
      const groupNo = generateOrderNo();
      const countyOrderGroup = await CountyOrderGroup.create({
        group_no: groupNo,
        user_id: user.id,
        main_merchant_id: summary.mainMerchantId,
        store_count: summary.storeCount,
        status: 0,
        goods_amount: summary.goodsAmount,
        delivery_fee: summary.deliveryFee,
        package_fee: summary.packageFee,
        discount_amount: summary.discountAmount,
        pay_amount: summary.payAmount,
        customer_town: customerTown,
        contact_phone: contact_phone || user.phone,
        contact_name: contact_name || user.nickname,
        delivery_address: deliveryAddressStr,
        address,
        delivery_latitude: finalCustomerLat,
        delivery_longitude: finalCustomerLng,
        customer_lng: finalCustomerLng,
        customer_lat: finalCustomerLat,
        remark
      }, { transaction: t });

      let mainOrderId = null;
      const orders = [];
      for (const shop of summary.shops) {
        const orderNo = generateOrderNo();
        const payAmount =
          round2(shop.totalAmount) +
          round2(shop.appliedDeliveryFee) +
          round2(shop.packageFee) -
          round2(shop.discountAmount);
        const itemsJson = JSON.stringify(shop.productsInfo);

        const order = await Order.create({
          order_no: orderNo,
          order_id: orderNo,
          user_id: user.id,
          merchant_id: shop.merchantId,
          type: 'takeout',
          order_type: 'county',
          customer_town: customerTown,
          merge_group_id: countyOrderGroup.id,
          is_group_main: shop.isMainStore,
          products_info: itemsJson,
          items_json: itemsJson,
          total_amount: round2(shop.totalAmount),
          delivery_fee: round2(shop.appliedDeliveryFee),
          package_fee: round2(shop.packageFee),
          discount_amount: round2(shop.discountAmount),
          pay_amount: payAmount,
          total_price: Number(payAmount),
          delivery_type: 1,
          contact_phone: contact_phone || user.phone,
          contact_name: contact_name || user.nickname,
          delivery_address: deliveryAddressStr,
          address,
          delivery_latitude: finalCustomerLat,
          delivery_longitude: finalCustomerLng,
          customer_lng: finalCustomerLng,
          customer_lat: finalCustomerLat,
          merchant_lng: shop.merchant.longitude,
          merchant_lat: shop.merchant.latitude,
          remark,
          status: 0
        }, { transaction: t });

        if (shop.isMainStore) {
          mainOrderId = order.id;
        }
        orders.push(order);
      }

      if (mainOrderId) {
        await countyOrderGroup.update({ main_order_id: mainOrderId }, { transaction: t });
      }

      await CartItem.destroy({
        where: { user_id: user.id },
        transaction: t
      });

      return { countyOrderGroup, orders };
    });

    const autoConfirmGroupResult = await autoConfirmCountyGroupIfNeeded({
      countyOrderGroup: created.countyOrderGroup,
      userId: user.id,
      source: 'county.group.create'
    });
    const finalCountyOrderGroup = autoConfirmGroupResult.countyOrderGroup || created.countyOrderGroup;
    const finalOrders = autoConfirmGroupResult.enabled ? autoConfirmGroupResult.orders : created.orders;
    if (autoConfirmGroupResult.enabled) {
      await notifyMerchantsForPaidOrders(finalOrders);
    }
    await socketService.broadcastDispatcherOrdersUpdate();

    res.status(201).json(successResponse({
      group_id: finalCountyOrderGroup.id,
      group_no: finalCountyOrderGroup.group_no,
      main_merchant_id: finalCountyOrderGroup.main_merchant_id,
      store_count: finalCountyOrderGroup.store_count,
      total_amount: finalCountyOrderGroup.goods_amount,
      package_fee: finalCountyOrderGroup.package_fee,
      discount_amount: finalCountyOrderGroup.discount_amount,
      delivery_fee: finalCountyOrderGroup.delivery_fee,
      pay_amount: finalCountyOrderGroup.pay_amount,
      status: finalCountyOrderGroup.status,
      orders: finalOrders
    }, autoConfirmGroupResult.enabled ? '县城美食多店订单创建成功（创建即已支付）' : '县城美食多店订单创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 支付订单（用户端）
 */
/**
 * 支付单笔订单
 * 创建订单后，如果没有走“创建即支付”，就会进入这个正式支付入口。
 */
exports.payOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.body?.order_id || req.body?.orderId || req.body?.orderID || req.body?.id;
    const channel = normalizePayChannel(req.body?.channel || req.body?.payMethod || req.body?.pay_method);

    const order = await Order.findOne({
      where: { id: orderId, user_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 0) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const tx = await paymentService.createPrepay({
      order,
      channel,
      requestPayload: { source: 'order.pay', user_id: user.id, channel }
    });

    const mode = process.env.PAYMENT_MODE || 'mock';
    if (isMockAutoConfirmEnabled(mode)) {
      const meta = buildMockConfirmMeta();
      const confirmed = await paymentService.confirmSuccess({
        outTradeNo: tx.out_trade_no,
        tradeNo: meta.tradeNo,
        notifyId: meta.notifyId,
        amount: tx.amount,
        notifyPayload: {
          source: 'order.pay.auto_confirm',
          user_id: user.id,
          order_id: order.id
        },
        channel: tx.channel
      });
      await notifyMerchantForPaidOrder(confirmed.order || order);
      return res.json(successResponse({
        order_id: order.id,
        out_trade_no: tx.out_trade_no,
        amount: round2(tx.amount),
        channel: tx.channel,
        mode,
        payment_status: 'success',
        awaiting_confirmation: false,
        auto_confirmed: true,
        order: confirmed.order || order
      }, '模拟支付已自动确认'));
    }

    res.json(
      successResponse(
        {
          order_id: order.id,
          out_trade_no: tx.out_trade_no,
          amount: round2(tx.amount),
          channel: tx.channel,
          mode,
          payment_status: 'pending',
          awaiting_confirmation: true
        },
        '支付请求已创建，等待支付确认'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 支付县城拼单订单
 * 给拼单组统一发起支付时走这里。
 */
exports.payCountyGroupOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const groupId = req.body?.group_id || req.body?.groupId || req.body?.id;
    const channel = normalizePayChannel(req.body?.channel || req.body?.payMethod || req.body?.pay_method);

    const countyOrderGroup = await CountyOrderGroup.findOne({
      where: { id: groupId, user_id: user.id }
    });
    if (!countyOrderGroup) {
      return res.status(404).json(errorResponse('拼单组不存在'));
    }
    if (countyOrderGroup.status !== 0) {
      return res.status(400).json(errorResponse('拼单组状态不正确'));
    }

    const tx = await paymentService.createPrepay({
      countyOrderGroup,
      channel,
      requestPayload: { source: 'county.group.pay', user_id: user.id, group_id: countyOrderGroup.id, channel }
    });

    const mode = process.env.PAYMENT_MODE || 'mock';
    if (isMockAutoConfirmEnabled(mode)) {
      const meta = buildMockConfirmMeta();
      const confirmed = await paymentService.confirmSuccess({
        outTradeNo: tx.out_trade_no,
        tradeNo: meta.tradeNo,
        notifyId: meta.notifyId,
        amount: tx.amount,
        notifyPayload: {
          source: 'county.group.pay.auto_confirm',
          user_id: user.id,
          group_id: countyOrderGroup.id
        },
        channel: tx.channel
      });
      await notifyMerchantsForPaidOrders(confirmed.orders);
      return res.json(successResponse({
        group_id: countyOrderGroup.id,
        group_no: countyOrderGroup.group_no,
        out_trade_no: tx.out_trade_no,
        amount: round2(tx.amount),
        channel: tx.channel,
        mode,
        payment_status: 'success',
        awaiting_confirmation: false,
        auto_confirmed: true,
        county_order_group: confirmed.countyOrderGroup || countyOrderGroup,
        orders: confirmed.orders
      }, '拼单模拟支付已自动确认'));
    }

    res.json(successResponse({
      group_id: countyOrderGroup.id,
      group_no: countyOrderGroup.group_no,
      out_trade_no: tx.out_trade_no,
      amount: round2(tx.amount),
      channel: tx.channel,
      mode,
      payment_status: 'pending',
      awaiting_confirmation: true
    }, '拼单支付请求已创建，等待支付确认'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取县城拼单详情
 * 前端打开拼单支付结果页或拼单详情页时，通常会走这个接口。
 */
exports.getCountyGroupOrderDetail = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const countyOrderGroup = await CountyOrderGroup.findOne({
      where: { id, user_id: user.id },
      include: [{
        model: Order,
        as: 'childOrders',
        include: [{
          model: Merchant,
          as: 'merchant',
          attributes: ['name', 'logo', 'phone', 'address', 'longitude', 'latitude']
        }],
        order: [['id', 'ASC']]
      }, {
        model: Merchant,
        as: 'mainMerchant',
        attributes: ['name', 'logo', 'phone', 'address', 'longitude', 'latitude']
      }]
    });

    if (!countyOrderGroup) {
      return res.status(404).json(errorResponse('拼单组不存在'));
    }

    res.json(successResponse({
      id: countyOrderGroup.id,
      group_no: countyOrderGroup.group_no,
      status: countyOrderGroup.status,
      customer_town: countyOrderGroup.customer_town,
      contact_name: countyOrderGroup.contact_name,
      contact_phone: countyOrderGroup.contact_phone,
      delivery_address: countyOrderGroup.delivery_address,
      delivery_fee: countyOrderGroup.delivery_fee,
      package_fee: countyOrderGroup.package_fee,
      discount_amount: countyOrderGroup.discount_amount,
      total_amount: countyOrderGroup.goods_amount,
      pay_amount: countyOrderGroup.pay_amount,
      main_merchant_id: countyOrderGroup.main_merchant_id,
      store_count: countyOrderGroup.store_count,
      main_merchant: countyOrderGroup.mainMerchant,
      orders: countyOrderGroup.childOrders
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的订单（用户端）
 */
/**
 * 获取用户订单列表
 * 用户端“我的订单”列表主要走这里。
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const user = req.user;
    const { status, type } = req.query;
    const isMerchantRole = user.role === 'merchant' || user.role === 'shop';
    let where;
    if (isMerchantRole) {
      const bindMerchant = await Merchant.findOne({ where: { user_id: user.id } });
      if (!bindMerchant) {
        console.log(`[order.my] merchant_user_id=${user.id} role=${user.role} merchant_not_found`);
        return res.status(404).json(errorResponse('您还没有店铺'));
      }
      where = { merchant_id: bindMerchant.id };
      if (status) where.status = status;
      if (type) where.type = type;
      console.log(`[order.my] merchant_user_id=${user.id} merchant_id=${bindMerchant.id} where=${JSON.stringify(where)}`);
    } else {
      where = {
        user_id: user.id,
        buyer_deleted_at: null
      };
      if (status) where.status = status;
      if (type) where.type = type;
      console.log(`[order.my] buyer_user_id=${user.id} where=${JSON.stringify(where)}`);
    }

    const orders = await Order.findAll({
      where,
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'logo', 'phone', 'address', 'longitude', 'latitude']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone', 'avatar', 'rider_longitude', 'rider_latitude', 'rider_location_updated_at']
      }, {
        model: Review,
        as: 'review',
        attributes: ['id', 'merchant_score', 'rider_score']
      }],
      order: [['id', 'DESC']]
    });

    const normalizedOrders = orders.map((order) => attachOrderReviewMeta(order));
    res.json(successResponse({ 订单列表: normalizedOrders, data: normalizedOrders }));
  } catch (error) {
    next(error);
  }
};

/**
 * 批量移出用户侧订单列表（仅软隐藏，不删除订单主数据）
 */
/**
 * 批量隐藏用户订单
 * 这里只是用户侧隐藏显示，不是删除订单。
 */
exports.hideUserOrdersBatch = async (req, res, next) => {
  try {
    const user = req.user;
    const orderIds = normalizeOrderIdList(req.body?.order_ids || req.body?.orderIds);

    if (!orderIds.length) {
      return res.status(400).json(errorResponse('请传入至少1个有效的订单ID'));
    }
    if (orderIds.length > USER_HIDE_BATCH_LIMIT) {
      return res.status(400).json(errorResponse(`单次最多移出${USER_HIDE_BATCH_LIMIT}条订单`));
    }

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: orderIds },
        user_id: user.id
      },
      attributes: ['id', 'order_no', 'status', 'buyer_deleted_at'],
      order: [['id', 'DESC']]
    });

    const orderMap = new Map(orders.map((item) => [Number(item.id), item]));
    const successIds = [];
    const failedIds = [];
    const failedReasons = [];
    const refundBlockedIds = new Set();
    const candidateIds = [];

    for (const orderId of orderIds) {
      const order = orderMap.get(orderId);
      if (!order) {
        failedIds.push(orderId);
        failedReasons.push({ order_id: orderId, reason: '订单不存在或无权操作' });
        continue;
      }
      if (order.buyer_deleted_at) {
        successIds.push(orderId);
        continue;
      }

      const blockedReason = getHideBlockedReasonByStatus(order.status);
      if (blockedReason) {
        failedIds.push(orderId);
        failedReasons.push({ order_id: orderId, reason: blockedReason });
        continue;
      }

      candidateIds.push(orderId);
    }

    if (candidateIds.length) {
      const activeRefunds = await Refund.findAll({
        where: {
          order_id: { [Op.in]: candidateIds },
          status: { [Op.in]: Array.from(ACTIVE_REFUND_STATUSES) }
        },
        attributes: ['order_id', 'status']
      });

      for (const refund of activeRefunds) {
        refundBlockedIds.add(Number(refund.order_id));
      }
    }

    const finalHideIds = [];
    for (const orderId of candidateIds) {
      if (refundBlockedIds.has(orderId)) {
        failedIds.push(orderId);
        failedReasons.push({ order_id: orderId, reason: '订单存在退款/售后处理中，暂不能移出列表' });
        continue;
      }
      finalHideIds.push(orderId);
    }

    let hiddenCount = 0;
    if (finalHideIds.length) {
      const hiddenAt = new Date();
      await sequelize.transaction(async (t) => {
        const [affectedCount] = await Order.update(
          { buyer_deleted_at: hiddenAt },
          {
            where: {
              id: { [Op.in]: finalHideIds },
              user_id: user.id,
              buyer_deleted_at: null
            },
            transaction: t
          }
        );
        hiddenCount = affectedCount;

        await OrderLog.bulkCreate(
          finalHideIds.map((orderId) => ({
            order_id: orderId,
            operator_id: user.id,
            operator_type: 'user',
            action: '用户移出订单列表',
            remark: '仅隐藏买家端订单列表展示，不删除订单主数据'
          })),
          { transaction: t }
        );
      });

      successIds.push(...finalHideIds);
    }

    const totalSuccess = successIds.length;
    const totalFailed = failedIds.length;
    const message =
      totalSuccess > 0
        ? totalFailed > 0
          ? `已移出${totalSuccess}条订单，${totalFailed}条未处理`
          : `已移出${totalSuccess}条订单`
        : '没有可移出的订单';

    console.log(
      `[order.hide-batch] user_id=${user.id} request_count=${orderIds.length} hidden_count=${hiddenCount} success_count=${totalSuccess} failed_count=${totalFailed}`
    );

    res.json(successResponse({
      success_ids: successIds,
      failed_ids: failedIds,
      failed_reasons: failedReasons,
      requested_count: orderIds.length,
      success_count: totalSuccess,
      failed_count: totalFailed
    }, message));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取订单详情
 */
/**
 * 获取订单详情
 * 这个接口会按当前登录角色自动收口可见范围，避免越权查看别人订单。
 */
exports.getOrderDetail = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id },
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'logo', 'phone', 'address', 'longitude', 'latitude']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone', 'avatar', 'rider_longitude', 'rider_latitude', 'rider_location_updated_at']
      }, {
        model: OrderLog,
        as: 'logs',
        order: [['id', 'DESC']]
      }, {
        model: Review,
        as: 'review',
        attributes: [
          'id',
          'merchant_score',
          'merchant_content',
          'merchant_images',
          'merchant_reply',
          'merchant_replied_at',
          'rider_score',
          'rider_content',
          'is_anonymous',
          'created_at'
        ]
      }]
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    const isMerchantRole = user.role === 'merchant' || user.role === 'shop';
    let mappedMerchantId = null;
    if (isMerchantRole) {
      const merchant = await Merchant.findOne({ where: { user_id: user.id } });
      mappedMerchantId = merchant?.id || null;
      if (!mappedMerchantId || order.merchant_id !== mappedMerchantId) {
        console.error(
          `[order.detail.403] token_user_id=${user.id} mapped_merchant_id=${mappedMerchantId} request_order_id=${id} order_merchant_id=${order.merchant_id}`
        );
        return res.status(403).json(errorResponse('没有权限查看'));
      }
    } else if (user.role === 'rider') {
      if (!canRiderViewOrderDetail(user, order)) {
        console.error(
          `[order.detail.403] token_user_id=${user.id} mapped_merchant_id=${mappedMerchantId} request_order_id=${id} order_merchant_id=${order.merchant_id}`
        );
        return res.status(403).json(errorResponse('没有权限查看'));
      }
    } else if (isMerchantDeliveryUser(user)) {
      if (!canMerchantDeliveryViewOrderDetail(user, order)) {
        console.error(
          `[order.detail.403] token_user_id=${user.id} bound_merchant_id=${user.bound_merchant_id || ''} request_order_id=${id} order_merchant_id=${order.merchant_id}`
        );
        return res.status(403).json(errorResponse('没有权限查看'));
      }
    } else if (order.user_id !== user.id) {
      console.error(
        `[order.detail.403] token_user_id=${user.id} mapped_merchant_id=${mappedMerchantId} request_order_id=${id} order_merchant_id=${order.merchant_id}`
      );
      return res.status(403).json(errorResponse('没有权限查看'));
    }

    const gaodeSearchAssist = await buildGaodeSearchAssist(order);
    const transferChain = await getOrderTransferChain(order.id, 10);

    const detail = appendTransferMetaToOrder({
      currentUser: user,
      transferChain,
      plain: {
      id: order.id,
      order_no: order.order_no,
      type: order.type,
      order_type: order.order_type,
      status: order.status,
      customer_town: order.customer_town || null,
      created_at: order.created_at,
      delivery_time: order.delivered_at || order.paid_at || null,
      delivery_time_type: order.delivery_time_type || DELIVERY_TIME_TYPES.ASAP,
      scheduled_delivery_at: order.scheduled_delivery_at || null,
      contact_name: order.contact_name,
      contact_phone: order.contact_phone,
      delivery_address: order.delivery_address,
      products_info: order.products_info,
      pay_amount: order.pay_amount,
      total_amount: order.total_amount,
      user_id: order.user_id,
      merchant_id: order.merchant_id,
      merchant_name: order.merchant?.name || '',
      merchant_phone: order.merchant?.phone || '',
      merchant_address: order.merchant?.address || '',
      merchant_logo: order.merchant?.logo || '',
      merchant: order.merchant ? {
        id: order.merchant_id,
        name: order.merchant.name || '',
        phone: order.merchant.phone || '',
        address: order.merchant.address || '',
        logo: order.merchant.logo || '',
        longitude: Number(order.merchant.longitude || 0) || null,
        latitude: Number(order.merchant.latitude || 0) || null
      } : null,
      rider_id: order.rider_id || null,
      riderId: order.rider_id || null,
      rider_longitude: Number(order.rider?.rider_longitude || 0) || null,
      rider_latitude: Number(order.rider?.rider_latitude || 0) || null,
      riderLongitude: Number(order.rider?.rider_longitude || 0) || null,
      riderLatitude: Number(order.rider?.rider_latitude || 0) || null,
      rider_location_updated_at: order.rider?.rider_location_updated_at || null,
      supermarket_delivery_permission_snapshot: order.supermarket_delivery_permission_snapshot || null,
      supermarket_delivery_mode: order.supermarket_delivery_mode || null,
      settlement_rule_snapshot: order.settlement_rule_snapshot || null,
      // 补充所有可能的坐标字段，防止骑手端导航缺失参数
      merchant_lng: Number(order.merchant_lng || order.merchant?.longitude || 0) || null,
      merchant_lat: Number(order.merchant_lat || order.merchant?.latitude || 0) || null,
      customer_lng: Number(order.customer_lng || order.delivery_longitude || 0) || null,
      customer_lat: Number(order.customer_lat || order.delivery_latitude || 0) || null,
      gaode_search_assist: gaodeSearchAssist,
      delivery_longitude: Number(order.delivery_longitude || order.customer_lng || 0) || null,
      delivery_latitude: Number(order.delivery_latitude || order.customer_lat || 0) || null,
      // 额外兼容驼峰命名和通用命名
      merchantLng: Number(order.merchant_lng || order.merchant?.longitude || 0) || null,
      merchantLat: Number(order.merchant_lat || order.merchant?.latitude || 0) || null,
      latitude: Number(order.customer_lat || order.delivery_latitude || 0) || null,
      longitude: Number(order.customer_lng || order.delivery_longitude || 0) || null,
      has_review: Boolean(order.review),
      review_id: order.review?.id || null,
      merchant_score: order.review?.merchant_score ?? null,
      rider_score: order.review?.rider_score ?? null,
      review: order.review ? {
        id: order.review.id,
        merchant_score: order.review.merchant_score,
        merchant_content: order.review.merchant_content || '',
        merchant_images: parseStoredReviewImages(order.review.merchant_images),
        merchant_reply: order.review.merchant_reply || '',
        merchant_replied_at: order.review.merchant_replied_at || null,
        rider_score: order.review.rider_score ?? null,
        rider_content: order.review.rider_content || '',
        is_anonymous: Boolean(order.review.is_anonymous),
        created_at: order.review.created_at || null
      } : null
      }
    });
    res.json(successResponse({
      ...detail,
      ...buildDeliveryOrderPresentation({
        user,
        order: detail
      })
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 提交订单评价
 * 用户完成订单后，对商家 / 骑手打分和写评价时走这里。
 */
exports.submitReview = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = Number(req.body?.order_id || req.body?.orderId || req.body?.id);
    const merchantScore = normalizeReviewScore(req.body?.merchant_score ?? req.body?.merchantScore);
    const riderScore = normalizeReviewScore(req.body?.rider_score ?? req.body?.riderScore);
    const merchantContent = normalizeReviewText(req.body?.merchant_content ?? req.body?.merchantContent);
    const riderContent = normalizeReviewText(req.body?.rider_content ?? req.body?.riderContent);
    const merchantImages = normalizeReviewImages(req.body?.merchant_images ?? req.body?.merchantImages);
    const isAnonymous = Boolean(req.body?.is_anonymous ?? req.body?.isAnonymous);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效的 order_id'));
    }
    if (merchantScore === null) {
      return res.status(400).json(errorResponse('商家评分必须是1到5分'));
    }

    const order = await Order.findOne({
      where: { id: orderId, user_id: user.id },
      include: [{
        model: Review,
        as: 'review',
        attributes: ['id']
      }]
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.type !== 'takeout') {
      return res.status(400).json(errorResponse('当前订单不支持评价'));
    }
    if (Number(order.status) !== 6) {
      return res.status(400).json(errorResponse('订单完成后才能评价'));
    }
    if (order.review) {
      return res.status(400).json(errorResponse('该订单已评价，请勿重复提交'));
    }
    if (riderScore !== null && !order.rider_id) {
      return res.status(400).json(errorResponse('当前订单没有骑手，不能提交骑手评分'));
    }

    const review = await Review.create({
      order_id: order.id,
      user_id: user.id,
      merchant_id: order.merchant_id,
      rider_id: order.rider_id || null,
      merchant_score: merchantScore,
      merchant_content: merchantContent || null,
      merchant_images: merchantImages.length ? JSON.stringify(merchantImages) : null,
      rider_score: riderScore,
      rider_content: riderContent || null,
      is_anonymous: isAnonymous,
      status: 1
    });

    res.status(201).json(successResponse({
      id: review.id,
      order_id: review.order_id,
      merchant_id: review.merchant_id,
      rider_id: review.rider_id,
      merchant_score: review.merchant_score,
      merchant_content: review.merchant_content || '',
      merchant_images: merchantImages,
      rider_score: review.rider_score,
      rider_content: review.rider_content || '',
      is_anonymous: Boolean(review.is_anonymous),
      created_at: review.created_at || null
    }, '评价成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消订单（用户端）
 */
/**
 * 取消订单
 * 用户取消订单时，会根据当前状态决定能否取消，并在需要时触发退款链路。
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, reason } = req.body;
    let cancelledOrder = null;
    let merchantUserId = null;

    await sequelize.transaction(async (t) => {
      const order = await Order.findOne({
        where: { id: order_id, user_id: user.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!order) {
        const err = new Error('订单不存在'); err.statusCode = 404; throw err;
      }

      if (![0, 1].includes(order.status)) {
        const err = new Error('当前状态不能取消'); err.statusCode = 400; throw err;
      }

      const fromStatus = order.status;
      await order.update({
        status: 7,
        cancel_reason: reason
      }, { transaction: t });

      if (fromStatus === 1) {
        await paymentService.processRefund({
          order,
          reason_type: '用户取消',
          description: reason,
          transaction: t
        });
      }

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'user',
        action: '取消订单',
        from_status: fromStatus,
        to_status: 7,
        remark: reason
      }, { transaction: t });

      cancelledOrder = order.get({ plain: true });
      const merchant = order.merchant_id
        ? await Merchant.findByPk(order.merchant_id, {
            attributes: ['user_id'],
            transaction: t
          })
        : null;
      merchantUserId = merchant?.user_id || null;
    });

    if (merchantUserId && cancelledOrder?.id) {
      socketService.notifyMerchantReminder(merchantUserId, cancelledOrder, {
        eventType: 'merchant_order_cancelled',
        title: '订单已取消',
        message: `订单 ${cancelledOrder.order_no} 已被用户取消`,
        speechText: '有订单已被用户取消，请及时查看',
        soundType: 'merchant_order_cancelled',
        priority: 'medium',
        jumpPath: '/pages/order/list',
        dedupeKey: `merchant_order_cancelled:${cancelledOrder.id}`
      });
    }
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(null, '订单已取消'));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message));
    }
    next(error);
  }
};

// ==================== 商家处理订单区 ====================
/**
 * 商家接单
 * 商家把订单从待接单推进到备餐中时走这里。
 */
exports.acceptOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { merchant_lng, merchant_lat } = req.body;
    // 兼容驼峰和蛇形命名，避免前端参数风格不一致时打挂接口。
    const order_id = req.body.order_id || req.body.orderId;
    console.log('[acceptOrder] 请求体:', JSON.stringify(req.body));
    console.log('[acceptOrder] order_id:', order_id, '类型:', typeof order_id);

    const merchant = await findOwnedMerchantByUserId(user.id);
    if (!merchant) {
      console.log('[acceptOrder] 商家不存在, user.id:', user.id);
      return res.status(404).json(errorResponse('您还没有店铺'));
    }
    console.log('[acceptOrder] 商家ID:', merchant.id);

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      console.log('[acceptOrder] 订单不存在, order_id:', order_id, 'merchant_id:', merchant.id);
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const ownershipError = getMerchantOrderOwnershipError(merchant, order);
    if (ownershipError) {
      return res.status(403).json(errorResponse(ownershipError));
    }

    console.log('[acceptOrder] 订单状态:', order.status, '类型:', typeof order.status);

    const statusNum = Number(order.status);
    if (![0, 1].includes(statusNum)) {
      console.log('[acceptOrder] 状态校验失败, statusNum:', statusNum);
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    const updateData = {
      status: 2,
      accepted_at: new Date(),
      // 商家坐标强制以数据库中的店铺真实坐标为准，不信前端传来的值。
      merchant_lng: Number(merchant.longitude) || merchant_lng || null,
      merchant_lat: Number(merchant.latitude) || merchant_lat || null
    };
    
    const [affectedCount] = await Order.update(updateData, {
      where: {
        id: order.id,
        status: order.status
      }
    });

    if (affectedCount === 0) {
      return res.status(400).json(errorResponse('接单失败：订单状态已被其他操作改变，请刷新列表'));
    }

    await order.reload();

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '接单',
      from_status: fromStatus,
      to_status: 2,
      remark: '商家已接单'
    });

    socketService.notifyUserOrderUpdate(order.user_id, order, '商家已接单，正在备餐中');

    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(order, '已接单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家拒单
 * 商家拒单时，如果订单已经支付，还会同步触发退款。
 */
exports.rejectOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { reason } = req.body;
    // 兼容驼峰和蛇形命名
    const order_id = req.body.order_id || req.body.orderId;

    const merchant = await findOwnedMerchantByUserId(user.id);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    await sequelize.transaction(async (t) => {
      const order = await Order.findOne({
        where: { id: order_id, merchant_id: merchant.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!order) {
        const err = new Error('订单不存在'); err.statusCode = 404; throw err;
      }

      const ownershipError = getMerchantOrderOwnershipError(merchant, order);
      if (ownershipError) {
        const err = new Error(ownershipError); err.statusCode = 403; throw err;
      }

      if (order.status !== 1) {
        const err = new Error('订单状态不正确'); err.statusCode = 400; throw err;
      }

      const fromStatus = order.status;
      await order.update({
        status: 7,
        cancel_reason: reason
      }, { transaction: t });

      if (fromStatus === 1) {
        await paymentService.processRefund({
          order,
          reason_type: '商家拒单',
          description: reason,
          transaction: t
        });
      }

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'merchant',
        action: '拒单',
        from_status: fromStatus,
        to_status: 7,
        remark: reason
      }, { transaction: t });
    });

    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(null, '已拒单'));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message));
    }
    next(error);
  }
};

/**
 * 商家备货完成/发货 (状态推进: 2 -> 3)
 * 这里既要推进状态，也要决定后续走骑手配送还是店铺自配送。
 */
exports.prepareOrder = async (req, res, next) => {
  try {
    const user = req.user;
    // 兼容驼峰和蛇形命名。
    const order_id = req.body.order_id || req.body.orderId;

    const merchant = await findOwnedMerchantByUserId(user.id);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    let order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const ownershipError = getMerchantOrderOwnershipError(merchant, order);
    if (ownershipError) {
      return res.status(403).json(errorResponse(ownershipError));
    }

    const statusNum = Number(order.status);
    if (statusNum !== 2) {
      return res.status(400).json(errorResponse('订单当前不是备餐中状态，无法出餐'));
    }

    const repairedDelivery = await repairOrderDeliveryFieldsIfNeeded(order, merchant);
    const supermarketDeliveryMode = repairedDelivery.mode;
    if (
      repairedDelivery.permission === SUPERMARKET_DELIVERY_PERMISSIONS.HYBRID &&
      supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.PENDING
    ) {
      return res.status(400).json(errorResponse('该订单还未选择配送方式，请先选择店铺自配送或骑手配送'));
    }

    const fromStatus = statusNum;
    const [affectedCount] = await Order.update({ status: 3 }, {
      where: {
        id: order.id,
        status: order.status
      }
    });

    if (affectedCount === 0) {
      return res.status(400).json(errorResponse('出餐失败：订单状态已被改变，请刷新列表'));
    }

    await order.reload();

    // region debug-point merchant-delivery-miss-prepare
    try {
      console.log('[merchant-delivery-debug][prepareOrder]', JSON.stringify({
        order_id: order.id,
        merchant_id: order.merchant_id,
        status: Number(order.status),
        supermarket_delivery_permission_snapshot: order.supermarket_delivery_permission_snapshot || null,
        supermarket_delivery_mode: order.supermarket_delivery_mode || null,
        rider_id: order.rider_id || null,
        current_responsible_user_id: order.current_responsible_user_id || null,
        current_responsible_role: order.current_responsible_role || null
      }));
    } catch (e) {}
    // endregion debug-point merchant-delivery-miss-prepare

    // 订单状态推进后，统一记订单日志并通知用户、调度端。
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '备货完成',
      from_status: fromStatus,
      to_status: 3,
      remark: supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY
        ? '商家已备货完成，等待店铺开始配送'
        : '商家已出餐，等待骑手取餐'
    });

    socketService.notifyUserOrderUpdate(
      order.user_id,
      order,
      supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY
        ? '商家已备货完成，店铺即将配送'
        : '商家已出餐，正在呼叫骑手'
    );
    await socketService.broadcastDispatcherOrdersUpdate();

    if (supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      return res.json(successResponse(order, '备货完成，等待店铺配送'));
    }

    let dispatchFailureMessage = null;

    // 尝试推给调度中心；乡镇订单进入待接单池，由骑手主动接单
    try {
      if (order.order_type === 'town') {
        await order.update({
          dispatch_center_status: 'town_pending_accept',
          rider_id: null,
          current_responsible_user_id: null,
          current_responsible_role: null
        });
        await order.reload();
      } else {
        const dispatchResult = await dispatchCenterService.pushOrderToDispatchCenter({ order, merchant });
        const dispatchOrderId =
          dispatchResult?.order_id ||
          dispatchResult?.id ||
          dispatchResult?.data?.order_id ||
          dispatchResult?.data?.id ||
          String(order.id);

        await order.update({
          dispatch_center_status: 'sent',
          dispatch_center_order_id: String(dispatchOrderId),
          dispatch_sent_at: new Date()
        });
        await order.reload();
        socketService.notifyDispatcherReminder(order, {
          eventType: 'dispatcher_order_ready',
          title: '新待派订单',
          message: `订单 ${order.order_no} 已出餐，等待调度派单`,
          speechText: '有新的县城待派订单，请及时派单',
          soundType: 'dispatcher_pending_order',
          priority: 'high',
          jumpType: 'dispatch_order',
          jumpPath: '/dispatch/orders',
          dedupeKey: `dispatcher_order_ready:${order.id}`,
          extra: {
            merchant_name: merchant?.name || '',
            customer_town: order.customer_town || ''
          }
        });
      }
    } catch (e) {
      console.error('推单或分配站长失败:', e);
      await order.update({
        dispatch_center_status: order.order_type === 'town' ? 'station_failed' : 'failed'
      });
      await OrderLog.create({
        order_id: order.id,
        operator_type: 'system',
        action: '分发异常',
        from_status: order.status,
        to_status: order.status,
        remark: `推单异常：${e.message || '未知错误'}，需人工干预`
      });
      socketService.notifyDispatcherReminder(order, {
        eventType: order.order_type === 'town' ? 'dispatcher_station_assign_failed' : 'dispatcher_dispatch_failed',
        title: order.order_type === 'town' ? '乡镇分配异常' : '推单异常',
        message: `订单 ${order.order_no} 分发失败，需要人工处理`,
        speechText: order.order_type === 'town' ? '有乡镇订单分配失败，请及时处理' : '有订单推送调度失败，请及时处理',
        soundType: 'dispatcher_exception',
        priority: 'high',
        jumpType: 'dispatch_exception',
        jumpPath: '/dispatch/orders',
        dedupeKey: `${order.order_type === 'town' ? 'dispatcher_station_assign_failed' : 'dispatcher_dispatch_failed'}:${order.id}`,
        extra: {
          merchant_name: merchant?.name || '',
          reason: e.message || '未知错误',
          order_type: order.order_type || ''
        }
      });

      dispatchFailureMessage = order.order_type === 'town'
        ? '备货完成，但乡镇待接单池创建失败，请人工处理'
        : '备货完成，但调度中心推送失败，请人工处理';
    }

    res.json(successResponse(
      order,
      dispatchFailureMessage || (order.order_type === 'town' ? '备货完成，等待乡镇骑手接单' : '备货完成，已提交调度中心')
    ));
  } catch (error) {
    next(error);
  }
};

// ==================== 骑手接单与配送完成区 ====================
/**
 * 骑手取餐完成 (状态推进: 4 -> 5)
 * 骑手确认从商家取到餐后，订单会推进到配送中。
 */
exports.riderPickup = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const order = await Order.findOne({ where: { id: order_id, rider_id: user.id } });
    if (!order) return res.status(404).json(errorResponse('订单不存在'));

    if (Number(order.status) !== 4) {
      return res.status(400).json(errorResponse('订单当前不是骑手已接单状态'));
    }

    const fromStatus = order.status;
    const [affectedCount] = await Order.update({ status: 5 }, {
      where: {
        id: order.id,
        status: order.status
      }
    });

    if (affectedCount === 0) {
      return res.status(400).json(errorResponse('取餐失败：订单状态已被改变'));
    }

    await order.reload();

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'rider',
      action: '骑手取餐',
      from_status: fromStatus,
      to_status: 5,
      remark: '骑手已取餐，正在为您配送'
    });

    socketService.notifyUserOrderUpdate(order.user_id, order, '骑手已取餐，正在配送中');
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(order, '取餐成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 骑手接单
 * 县城骑手、乡镇骑手接待配送订单时主要走这个入口。
 */
exports.acceptTakeoutOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body || {};

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以接单'));
    }

    const scope = resolveRiderScope(user);
    if (scope.delivery_scope !== 'town_delivery') {
      return res.status(403).json(errorResponse('当前仅支持乡镇骑手接乡镇订单'));
    }

    const acceptedOrder = await sequelize.transaction(async (t) => {
      const order = await Order.findOne({
        where: { id: order_id, type: 'takeout' },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!order) {
        const err = new Error('订单不存在');
        err.statusCode = 404;
        throw err;
      }

      if (order.order_type !== 'town') {
        const err = new Error('当前订单不是乡镇外卖订单');
        err.statusCode = 400;
        throw err;
      }

      const orderTownName = normalizeTownName(order.customer_town || order.transfer_to_town_name);
      if (scope.town_name && orderTownName && normalizeTownName(scope.town_name) !== orderTownName) {
        const err = new Error('不能接非本乡镇订单');
        err.statusCode = 403;
        throw err;
      }

      if (![3, 4].includes(Number(order.status))) {
        const err = new Error('当前订单暂不能接单，请刷新后重试');
        err.statusCode = 400;
        throw err;
      }

      if (order.rider_id || order.current_responsible_user_id) {
        const err = new Error('订单已被其他骑手接走，请刷新列表');
        err.statusCode = 400;
        throw err;
      }

      const fromStatus = Number(order.status);
      await order.update({
        rider_id: user.id,
        current_responsible_user_id: user.id,
        current_responsible_role: isTownStationmaster(user) ? 'town_stationmaster' : 'town_rider',
        dispatch_center_status: 'town_accepted'
      }, { transaction: t });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'rider',
        action: '乡镇骑手接单',
        from_status: fromStatus,
        to_status: fromStatus,
        remark: `${user.nickname || user.phone || user.id} 已接单`
      }, { transaction: t });

      return order;
    });

    const refreshed = await Order.findByPk(acceptedOrder.id, {
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone', 'longitude', 'latitude'] },
        { model: User, as: 'rider', attributes: ['nickname', 'phone', 'avatar'] }
      ]
    });

    socketService.notifyUserOrderUpdate(refreshed.user_id, refreshed, '骑手已接单，正在赶往商家');
    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(refreshed, '接单成功'));
  } catch (error) {
    next(error);
  }
};

// 这两个内部函数都是“订单完结处理器”。
// 一个给普通骑手配送完成用，一个给商家自配送完成用，核心目的是统一结算、记日志、发通知。
const completeRiderOrder = async ({
  order,
  user,
  action,
  remark,
  notifyMessage,
  successMessage
}) => {
  await sequelize.transaction(async (t) => {
    const lockedOrder = await Order.findOne({
      where: { id: order.id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (Number(lockedOrder.status) === 6) {
      throw new Error('订单已送达，请勿重复操作');
    }
    if (Number(lockedOrder.status) !== 5) {
      throw new Error('订单状态不正确，无法送达');
    }

    const fromStatus = Number(lockedOrder.status);
    await lockedOrder.update(
      {
        status: 6,
        delivered_at: new Date(),
        settled_at: new Date()
      },
      { transaction: t }
    );

    await user.increment('rider_balance', { by: Number(lockedOrder.rider_fee || 0), transaction: t });

    const merchant = await Merchant.findByPk(lockedOrder.merchant_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (merchant) {
      const merchantIncome = Number(lockedOrder.merchant_income_amount || 0);
      if (merchantIncome > 0) {
        await merchant.increment(
          { balance: merchantIncome, total_income: merchantIncome },
          { transaction: t }
        );
      }
    }

    await OrderLog.create(
      {
        order_id: lockedOrder.id,
        operator_id: user.id,
        operator_type: 'rider',
        action,
        from_status: fromStatus,
        to_status: 6,
        remark
      },
      { transaction: t }
    );
  });

  const refreshed = await Order.findByPk(order.id);
  socketService.notifyUserOrderUpdate(order.user_id, refreshed, notifyMessage);
  const merchant = await Merchant.findByPk(order.merchant_id, { attributes: ['id', 'user_id', 'name'] });
  if (merchant?.user_id) {
    socketService.notifyMerchantReminder(merchant.user_id, refreshed, {
      eventType: 'merchant_order_updated',
      title: '订单状态更新',
      message: `订单${refreshed?.order_no || order.order_no || order.id}已完成，请及时查看`,
      speechText: '您有订单状态更新，请及时查看',
      soundType: 'merchant_reminder',
      priority: 'normal',
      jumpPath: '/pages/order/list',
      dedupeKey: `merchant_order_updated:${order.id}:completed`
    });
  }
  await socketService.broadcastDispatcherOrdersUpdate();
  const refreshedPlain = refreshed?.get ? refreshed.get({ plain: true }) : refreshed;
  return successResponse({
    ...refreshedPlain,
    ...buildDeliveryOrderPresentation({
      user,
      order: refreshedPlain
    })
  }, successMessage);
};

const completeMerchantSelfDeliveryOrder = async ({
  order,
  merchant,
  viewerUser,
  operatorUserId,
  operatorType = 'merchant',
  action,
  remark,
  notifyMessage,
  successMessage
}) => {
  await sequelize.transaction(async (t) => {
    const lockedOrder = await Order.findOne({
      where: { id: order.id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (Number(lockedOrder.status) === 6) {
      throw new Error('订单已送达，请勿重复操作');
    }
    if (Number(lockedOrder.status) !== 5) {
      throw new Error('订单状态不正确，无法送达');
    }

    const fromStatus = Number(lockedOrder.status);
    await lockedOrder.update(
      {
        status: 6,
        delivered_at: new Date(),
        settled_at: new Date()
      },
      { transaction: t }
    );

    const lockedMerchant = await Merchant.findByPk(merchant.id, { transaction: t, lock: t.LOCK.UPDATE });
    const merchantIncome = Number(lockedOrder.merchant_income_amount || 0);
    if (merchantIncome > 0 && lockedMerchant) {
      await lockedMerchant.increment(
        { balance: merchantIncome, total_income: merchantIncome },
        { transaction: t }
      );
    }

    await OrderLog.create(
      {
        order_id: lockedOrder.id,
        operator_id: operatorUserId || merchant.user_id || null,
        operator_type: operatorType,
        action,
        from_status: fromStatus,
        to_status: 6,
        remark
      },
      { transaction: t }
    );
  });

  const refreshed = await Order.findByPk(order.id);
  socketService.notifyUserOrderUpdate(order.user_id, refreshed, notifyMessage);
  if (merchant?.user_id) {
    socketService.notifyMerchantReminder(merchant.user_id, refreshed, {
      eventType: 'merchant_order_updated',
      title: '订单状态更新',
      message: `订单${refreshed?.order_no || order.order_no || order.id}已完成，请及时查看`,
      speechText: '您有订单状态更新，请及时查看',
      soundType: 'merchant_reminder',
      priority: 'normal',
      jumpPath: '/pages/order/list',
      dedupeKey: `merchant_order_updated:${order.id}:completed`
    });
  }
  await socketService.broadcastDispatcherOrdersUpdate();
  const refreshedPlain = refreshed?.get ? refreshed.get({ plain: true }) : refreshed;
  return successResponse({
    ...refreshedPlain,
    ...buildDeliveryOrderPresentation({
      user: viewerUser || {},
      order: refreshedPlain
    })
  }, successMessage);
};

const normalizeOrderLogOperatorType = (rawType = '') => {
  return normalizeDeliveryLogOperatorType(rawType);
};

/**
 * 选择超市配送方式
 * 双模式超市订单在出餐前，需要先逐单选择“店铺自配送”还是“骑手配送”。
 */
exports.selectSupermarketDeliveryMode = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.body.order_id || req.body.orderId;
    const selectedMode = normalizeSupermarketDeliveryMode(
      req.body.supermarket_delivery_mode ?? req.body.delivery_mode ?? req.body.deliveryMode
    );

    if (!selectedMode || ![
      SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY,
      SUPERMARKET_DELIVERY_MODES.RIDER_DELIVERY
    ].includes(selectedMode)) {
      return res.status(400).json(errorResponse('请选择有效的店铺配送方式'));
    }

    const merchant = await findOwnedMerchantByUserId(user.id);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: orderId, merchant_id: merchant.id }
    });
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const ownershipError = getMerchantOrderOwnershipError(merchant, order);
    if (ownershipError) {
      return res.status(403).json(errorResponse(ownershipError));
    }

    if (order.supermarket_delivery_permission_snapshot !== SUPERMARKET_DELIVERY_PERMISSIONS.HYBRID) {
      return res.status(400).json(errorResponse('当前店铺不是“双模式”配送，不能逐单切换配送方式'));
    }

    if (![1, 2, 3].includes(Number(order.status))) {
      return res.status(400).json(errorResponse('当前订单阶段不允许修改配送方式'));
    }

    const settlementPatch = buildTakeoutSettlementPatch({
      ...order.get({ plain: true }),
      supermarket_delivery_mode: selectedMode
    });

    await order.update({
      supermarket_delivery_mode: selectedMode,
      ...settlementPatch
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '选择店铺配送方式',
      from_status: Number(order.status),
      to_status: Number(order.status),
      remark: selectedMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY ? '本单改为店铺自配送' : '本单改为骑手配送'
    });

    const refreshed = await Order.findByPk(order.id);
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(
      refreshed,
      Number(order.status) === 3 ? '配送方式已补选并立即生效' : '配送方式已锁定'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家自配送确认送达
 * 这里只给店铺自配送链路使用，内部复用统一的配送完成服务。
 */
exports.confirmMerchantSelfDelivery = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.body.order_id || req.body.orderId;
    const isMerchantDeliveryOperator = isMerchantDeliveryUser(user);
    const merchant = await findOperableMerchantByUser(user);
    if (!merchant) {
      return res.status(404).json(errorResponse(isMerchantDeliveryOperator ? '当前账号未绑定店铺' : '您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: orderId, merchant_id: merchant.id }
    });
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const ownershipError = getMerchantOrderOwnershipError(merchant, order);
    if (ownershipError) {
      return res.status(403).json(errorResponse(ownershipError));
    }

    const repairedDelivery = await repairOrderDeliveryFieldsIfNeeded(order, merchant);
    if (repairedDelivery.mode !== SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      return res.status(400).json(errorResponse('当前订单不是店铺自配送，不能由店铺直接完结'));
    }

    const latestRider = isMerchantDeliveryOperator
      ? await User.findByPk(user.id, {
          attributes: ['id', 'rider_longitude', 'rider_latitude', 'rider_location_updated_at']
        })
      : null;
    const completionMeta = prepareMerchantSelfDeliveryCompletion({
      order,
      user,
      latestActor: latestRider,
      isMerchantDeliveryOperator
    });

    const response = await completeMerchantSelfDeliveryOrder({
      order,
      merchant,
      viewerUser: user,
      operatorUserId: user.id,
      operatorType: normalizeOrderLogOperatorType(completionMeta.operatorType),
      action: completionMeta.action,
      remark: completionMeta.remark,
      notifyMessage: completionMeta.notifyMessage,
      successMessage: completionMeta.successMessage
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};


/**
 * 骑手确认送达
 */
/**
 * 骑手确认送达
 * 普通骑手把订单从配送中推进到已完成时，主要走这里。
 */
exports.confirmDelivery = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以确认送达'));
    }

    const order = await Order.findOne({
      where: { id: order_id, rider_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const latestRider = await User.findByPk(user.id, {
      attributes: ['id', 'rider_longitude', 'rider_latitude', 'rider_location_updated_at']
    });
    const completionMeta = prepareRiderDeliveryCompletion({
      order,
      user,
      latestActor: latestRider
    });

    const response = await completeRiderOrder({
      order,
      user,
      action: completionMeta.logPayload.action,
      remark: completionMeta.logPayload.remark,
      notifyMessage: completionMeta.notifyMessage,
      successMessage: completionMeta.successMessage
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 特殊送达确认
 * 这是历史兼容入口，保留给特殊场景使用。
 */
exports.confirmDeliverySpecial = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, remark } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以特殊完结订单'));
    }

    const order = await Order.findOne({
      where: { id: order_id, rider_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const currentStatus = Number(order.status);
    if (![2, 3, 4, 5].includes(currentStatus)) {
      return res.status(400).json(errorResponse('当前状态不允许特殊完结'));
    }

    const response = await completeRiderOrder({
      order,
      user,
      action: '特殊完结',
      remark: (typeof remark === 'string' && remark.trim()) || `骑手特殊完结订单，原状态:${currentStatus}`,
      notifyMessage: '订单已特殊完结',
      successMessage: '特殊完结成功'
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ==================== 转派链路区 ====================
// 县城骑手可以把订单转给乡镇站长，乡镇站长再转给乡镇骑手，这一整套都收在这里。
exports.getTransferStationmasters = async (req, res, next) => {
 * 获取可转派的乡镇站长列表
 * 县城骑手发起转派前，会先查目标乡镇有哪些站长可接。
 */
exports.getTransferStationmasters = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const scope = resolveRiderScope(user);
    if (scope.delivery_scope !== 'county_delivery') {
      return res.status(403).json(errorResponse('只有县城司机可以发起转派'));
    }

    const townName = normalizeTownName(req.query?.town_name || req.query?.townName);
    if (!townName) {
      return res.status(400).json(errorResponse('缺少目标乡镇'));
    }

    const stationmasters = await User.findAll({
      where: {
        role: 'rider',
        status: 1,
        delivery_scope: 'town_delivery',
        rider_level: 'captain',
        [Op.or]: [
          { town_name: townName },
          { rider_town: townName }
        ]
      },
      attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town', 'rider_status'],
      order: [['rider_status', 'DESC'], ['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
    });

    const data = stationmasters.map((item) => ({
      id: item.id,
      nickname: item.nickname || '',
      phone: item.phone || '',
      rider_kind: item.rider_kind || '',
      rider_level: item.rider_level || '',
      delivery_scope: item.delivery_scope || '',
      town_name: item.town_name || item.rider_town || '',
      rider_status: Number(item.rider_status || 0)
    }));

    res.json(successResponse(data));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取可转派的乡镇骑手列表
 * 乡镇站长把订单继续下发给乡镇骑手时，会先走这个接口。
 */
exports.getTransferTownRiders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const rawOrderId = req.query?.order_id || req.query?.orderId;
    const order = await findTransferOrderByInput(rawOrderId);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (!canTownDispatcherTransferToRider(user, order)) {
      return res.status(403).json(errorResponse('当前订单不允许转给乡镇骑手'));
    }

    const scope = resolveRiderScope(user);
    const riders = await User.findAll({
      where: buildTownRiderUserWhere({
        townName: scope.town_name || order.customer_town,
        excludeUserId: user.id
      }),
      attributes: [
        'id',
        'nickname',
        'phone',
        'rider_kind',
        'rider_level',
        'delivery_scope',
        'town_code',
        'town_name',
        'rider_town',
        'rider_status'
      ],
      order: [['rider_status', 'DESC'], ['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
    });

    const data = riders.map((item) => ({
      id: item.id,
      nickname: item.nickname || '',
      real_name: null,
      phone: item.phone || '',
      rider_kind: item.rider_kind || 'rider',
      rider_level: item.rider_level || 'normal',
      delivery_scope: item.delivery_scope || '',
      town_code: item.town_code || '',
      town_name: item.town_name || item.rider_town || scope.town_name || '',
      is_online: Number(item.rider_status || 0) === 1 ? 1 : 0,
      can_receive_transfer: 1
    }));

    res.json(successResponse(data));
  } catch (error) {
    next(error);
  }
};

/**
 * 转派给乡镇站长
 * 县城骑手把乡镇订单转交给目标乡镇站长时走这里。
 */
exports.transferOrderToStationmaster = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = Number(req.body?.order_id || req.body?.orderId);
    const targetTownName = normalizeTownName(req.body?.target_town_name || req.body?.targetTownName);
    const targetUserId = Number(req.body?.target_user_id || req.body?.targetUserId);
    const remark = String(req.body?.remark || '').trim();

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效订单ID'));
    }

    const order = await Order.findOne({
      where: { id: orderId },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
        { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ]
    });
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (!canRiderTransferOrder(user, order)) {
      return res.status(403).json(errorResponse('当前订单不允许转派给乡镇站长'));
    }

    const resolvedTargetTownName = targetTownName || normalizeTownName(order.customer_town);
    if (!resolvedTargetTownName) {
      return res.status(400).json(errorResponse('当前订单缺少目标乡镇，不能转派'));
    }
    if (normalizeTownName(order.customer_town) && normalizeTownName(order.customer_town) !== resolvedTargetTownName) {
      return res.status(400).json(errorResponse('目标乡镇必须与订单所属乡镇一致'));
    }

    let targetStationmaster = null;
    if (Number.isInteger(targetUserId) && targetUserId > 0) {
      targetStationmaster = await User.findOne({
        where: {
          id: targetUserId,
          role: 'rider',
          status: 1,
          delivery_scope: 'town_delivery',
          rider_level: 'captain',
          [Op.or]: [
            { town_name: resolvedTargetTownName },
            { rider_town: resolvedTargetTownName }
          ]
        }
      });
    } else {
      targetStationmaster = await findTownStationmasterByTownName(resolvedTargetTownName);
    }

    if (!targetStationmaster) {
      return res.status(400).json(errorResponse(`未找到【${resolvedTargetTownName}】乡镇站长`));
    }
    if (Number(targetStationmaster.id) === Number(user.id)) {
      return res.status(400).json(errorResponse('不能转派给自己'));
    }

    const now = new Date();
    await sequelize.transaction(async (t) => {
      const lockedOrder = await Order.findOne({
        where: { id: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!canRiderTransferOrder(user, lockedOrder)) {
        throw new Error('当前订单状态已改变，不允许转派给乡镇站长');
      }

      const latestTransfer = await getLatestOrderTransfer(lockedOrder.id, { transaction: t });
      const nextRound = Number(latestTransfer?.transfer_round || 0) + 1;

      await OrderTransfer.create({
        order_id: lockedOrder.id,
        transfer_round: nextRound,
        from_user_id: user.id,
        from_role: resolveTransferActorRole(user),
        from_scope: resolveRiderScope(user).delivery_scope,
        from_town_name: resolveRiderScope(user).town_name,
        to_user_id: targetStationmaster.id,
        to_role: resolveTransferActorRole(targetStationmaster),
        to_scope: resolveRiderScope(targetStationmaster).delivery_scope,
        to_town_name: resolvedTargetTownName,
        status_before_transfer: Number(lockedOrder.status),
        remark: remark || `县城司机转派到【${resolvedTargetTownName}】站长`
      }, { transaction: t });

      await lockedOrder.update({
        rider_id: targetStationmaster.id,
        is_transfer_order: true,
        transfer_status: 'transferred',
        transfer_round: nextRound,
        current_responsible_user_id: targetStationmaster.id,
        current_responsible_role: resolveTransferActorRole(targetStationmaster),
        transfer_from_user_id: user.id,
        transfer_to_user_id: targetStationmaster.id,
        transfer_to_town_name: resolvedTargetTownName,
        transfer_last_action_at: now,
        transfer_last_action_type: 'transfer'
      }, { transaction: t });

      await OrderLog.create({
        order_id: lockedOrder.id,
        operator_id: user.id,
        operator_type: 'rider',
        action: '县城司机转派乡镇站长',
        from_status: Number(lockedOrder.status),
        to_status: Number(lockedOrder.status),
        remark: `已转派给【${resolvedTargetTownName}】站长：${targetStationmaster.nickname || targetStationmaster.phone || targetStationmaster.id}`
      }, { transaction: t });
    });

    const refreshed = await Order.findOne({
      where: { id: order.id },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
        { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ]
    });
    const transferChain = await getOrderTransferChain(order.id, 10);
    const payload = appendTransferMetaToOrder({
      plain: refreshed.get({ plain: true }),
      currentUser: user,
      transferChain
    });

    socketService.notifyRiderNewOrder(targetStationmaster.id, payload, {
      eventType: 'rider_transfer_assigned',
      title: '转派订单',
      message: '您收到一笔转派配送订单',
      speechText: '您有新的转派订单，请及时查看',
      soundType: 'rider_transfer_assigned',
      priority: 'high',
      jumpPath: '/pages/orders/index',
      dedupeKey: `rider_transfer_assigned:${order.id}:${targetStationmaster.id}`
    });
    socketService.notifyUserOrderUpdate(order.user_id, refreshed, '订单已转派至乡镇站长继续配送');
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(payload, '转派成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 转派给乡镇骑手
 * 乡镇站长把订单继续派给自己乡镇内的骑手时走这里。
 */
exports.transferOrderToTownRider = async (req, res, next) => {
  try {
    const user = req.user;
    const rawOrderId = req.body?.order_id || req.body?.orderId;
    const targetRiderId = Number(req.body?.target_rider_id || req.body?.targetRiderId);
    const remark = String(req.body?.remark || '').trim();

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }
    if (!Number.isInteger(targetRiderId) || targetRiderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效目标骑手ID'));
    }

    const order = await findTransferOrderByInput(rawOrderId);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (!canTownDispatcherTransferToRider(user, order)) {
      return res.status(403).json(errorResponse('当前订单不允许转给乡镇骑手'));
    }

    const targetTownName = normalizeTownName(order.customer_town || order.transfer_to_town_name || resolveRiderScope(user).town_name);
    const targetRider = await User.findOne({
      where: {
        id: targetRiderId,
        ...buildTownRiderUserWhere({
          townName: targetTownName,
          excludeUserId: user.id
        })
      }
    });

    if (!targetRider) {
      return res.status(400).json(errorResponse('目标骑手不存在或不属于当前乡镇'));
    }

    const now = new Date();
    await sequelize.transaction(async (t) => {
      const lockedOrder = await Order.findOne({
        where: { id: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!canTownDispatcherTransferToRider(user, lockedOrder)) {
        throw new Error('当前订单状态已改变，不允许转派');
      }

      const latestTransfer = await getLatestOrderTransfer(lockedOrder.id, { transaction: t });
      const nextRound = Number(latestTransfer?.transfer_round || 0) + 1;

      await OrderTransfer.create({
        order_id: lockedOrder.id,
        transfer_round: nextRound,
        from_user_id: user.id,
        from_role: resolveTransferActorRole(user),
        from_scope: resolveRiderScope(user).delivery_scope,
        from_town_name: resolveRiderScope(user).town_name,
        to_user_id: targetRider.id,
        to_role: resolveTransferActorRole(targetRider),
        to_scope: resolveRiderScope(targetRider).delivery_scope,
        to_town_name: targetTownName,
        status_before_transfer: Number(lockedOrder.status),
        remark: remark || `乡镇站长转派给骑手：${targetRider.nickname || targetRider.phone || targetRider.id}`
      }, { transaction: t });

      await lockedOrder.update({
        rider_id: targetRider.id,
        is_transfer_order: true,
        transfer_status: 'assigned_to_town_rider',
        transfer_round: nextRound,
        current_responsible_user_id: targetRider.id,
        current_responsible_role: resolveTransferActorRole(targetRider),
        transfer_from_user_id: user.id,
        transfer_to_user_id: targetRider.id,
        transfer_to_town_name: targetTownName,
        transfer_last_action_at: now,
        transfer_last_action_type: 'transfer'
      }, { transaction: t });

      await OrderLog.create({
        order_id: lockedOrder.id,
        operator_id: user.id,
        operator_type: 'rider',
        action: '乡镇站长转派乡镇骑手',
        from_status: Number(lockedOrder.status),
        to_status: Number(lockedOrder.status),
        remark: `已转给骑手：${targetRider.nickname || targetRider.phone || targetRider.id}`
      }, { transaction: t });
    });

    const refreshed = await Order.findOne({
      where: { id: order.id },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
        { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ]
    });
    const transferChain = await getOrderTransferChain(order.id, 10);
    const payload = appendTransferMetaToOrder({
      plain: refreshed.get({ plain: true }),
      currentUser: user,
      transferChain
    });

    socketService.notifyRiderNewOrder(targetRider.id, payload, {
      eventType: 'rider_transfer_assigned',
      title: '转派订单',
      message: '您收到一笔转派配送订单',
      speechText: '您有新的转派订单，请及时查看',
      soundType: 'rider_transfer_assigned',
      priority: 'high',
      jumpPath: '/pages/orders/index',
      dedupeKey: `rider_transfer_assigned:${order.id}:${targetRider.id}`
    });
    socketService.notifyUserOrderUpdate(order.user_id, refreshed, '订单已由乡镇骑手接手配送');
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(payload, '转交成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 撤回转派
 * 如果转派后还没真正完成后续接手，可以按规则撤回。
 */
exports.revokeTransferredOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = Number(req.body?.order_id || req.body?.orderId);
    const revokeRemark = String(req.body?.remark || '').trim();

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效订单ID'));
    }

    const order = await Order.findOne({
      where: { id: orderId },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
        { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ]
    });
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const latestTransfer = await getLatestOrderTransfer(order.id);
    if (!canRiderRevokeTransfer(user, order, latestTransfer)) {
      return res.status(403).json(errorResponse('当前转派记录不允许撤回'));
    }

    const now = new Date();
    await sequelize.transaction(async (t) => {
      await latestTransfer.update({
        is_revoked: true,
        revoked_at: now,
        revoked_by_user_id: user.id,
        revoke_remark: revokeRemark || '县城司机撤回转派'
      }, { transaction: t });

      await order.update({
        rider_id: latestTransfer.from_user_id,
        transfer_status: 'revoked',
        current_responsible_user_id: latestTransfer.from_user_id,
        current_responsible_role: latestTransfer.from_role,
        transfer_last_action_at: now,
        transfer_last_action_type: 'revoke',
        transfer_revoke_used: true
      }, { transaction: t });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'rider',
        action: '撤回转派',
        from_status: Number(order.status),
        to_status: Number(order.status),
        remark: revokeRemark || '已撤回最近一跳转派'
      }, { transaction: t });
    });

    const refreshed = await Order.findOne({
      where: { id: order.id },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['id', 'name', 'address', 'phone', 'town_name'] },
        { model: User, as: 'rider', attributes: ['id', 'nickname', 'phone', 'avatar'] }
      ]
    });
    const transferChain = await getOrderTransferChain(order.id, 10);
    const payload = appendTransferMetaToOrder({
      plain: refreshed.get({ plain: true }),
      currentUser: user,
      transferChain
    });

    socketService.emitToRider(latestTransfer.to_user_id, 'order_transfer_revoked', {
      type: 'order_transfer_revoked',
      order_id: order.id,
      timestamp: now,
      data: payload
    });
    socketService.notifyRiderReminder(latestTransfer.to_user_id, order, {
      eventType: 'rider_transfer_revoked',
      title: '转派已撤回',
      message: '该转派订单已被站长撤回，请停止处理',
      speechText: '有转派订单已被撤回，请及时查看',
      soundType: 'rider_transfer_revoked',
      priority: 'medium',
      jumpPath: '/pages/orders/index',
      dedupeKey: `rider_transfer_revoked:${order.id}:${latestTransfer.to_user_id}`
    });
    await socketService.broadcastDispatcherOrdersUpdate();
    res.json(successResponse(payload, '撤回成功'));
  } catch (error) {
    next(error);
  }
};

// ==================== 骑手端订单列表与跑腿单区 ====================
exports.getAvailableOrders = async (req, res, next) => {
 * 获取可见订单列表
 * 这里主要返回当前骑手可见的已配送 / 已完成订单，并补齐转派链信息。
 */
exports.getAvailableOrders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const where = buildRiderVisibleOrderWhere(user);
    where.status = { [Op.in]: [5, 6] };

    const orders = await Order.findAll({
      where,
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
        { model: User, as: 'user', attributes: ['nickname', 'phone'] }
      ],
      order: [['id', 'DESC']]
    });

    const orderIds = orders.map((item) => item.id);
    const transfers = orderIds.length
      ? await OrderTransfer.findAll({
          where: { order_id: { [Op.in]: orderIds } },
          include: [
            { model: User, as: 'fromUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
            { model: User, as: 'toUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
            { model: User, as: 'revokedByUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] }
          ],
          order: [['id', 'DESC']]
        })
      : [];
    const transferMap = new Map();
    transfers.forEach((item) => {
      const serialized = serializeTransferRecord(item);
      const existing = transferMap.get(item.order_id) || [];
      existing.push(serialized);
      transferMap.set(item.order_id, existing);
    });

    const normalized = orders.map((item) => appendTransferMetaToOrder({
      plain: item.get({ plain: true }),
      currentUser: user,
      transferChain: transferMap.get(item.id) || []
    }));

    res.json(successResponse(normalized));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的配送订单（骑手端）
 * 普通骑手和商家自配送员的订单大厅，都会走这个接口。
 */
exports.getRiderOrders = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!['rider', MERCHANT_DELIVERY_ROLE].includes(user.role)) {
      return res.status(403).json(errorResponse('只有配送账号可以查看'));
    }

    const { status } = req.query;
    const where = isMerchantDeliveryUser(user)
      ? buildMerchantDeliveryVisibleOrderWhere(
          user,
          await resolveMerchantEffectiveDeliveryPermission(await findBoundMerchantByUser(user))
        )
      : buildRiderVisibleOrderWhere(user);
    if (status) where.status = status;

    // region debug-point merchant-delivery-miss-rider-orders
    try {
      console.log('[merchant-delivery-debug][getRiderOrders.request]', JSON.stringify({
        user_id: user.id,
        role: user.role,
        bound_merchant_id: user.bound_merchant_id || null,
        query_status: status || null,
        where
      }));
    } catch (e) {}
    // endregion debug-point merchant-delivery-miss-rider-orders

    const orders = await Order.findAll({
      where,
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'address', 'phone', 'longitude', 'latitude'] // 补充经纬度
      }, {
        model: User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    // region debug-point merchant-delivery-miss-rider-orders-result
    try {
      console.log('[merchant-delivery-debug][getRiderOrders.result]', JSON.stringify({
        user_id: user.id,
        role: user.role,
        bound_merchant_id: user.bound_merchant_id || null,
        count: orders.length,
        order_ids: orders.map((item) => item.id),
        orders: orders.map((item) => ({
          id: item.id,
          merchant_id: item.merchant_id,
          status: Number(item.status),
          supermarket_delivery_permission_snapshot: item.supermarket_delivery_permission_snapshot || null,
          supermarket_delivery_mode: item.supermarket_delivery_mode || null,
          rider_id: item.rider_id || null,
          current_responsible_user_id: item.current_responsible_user_id || null,
          current_responsible_role: item.current_responsible_role || null
        }))
      }));
    } catch (e) {}
    // endregion debug-point merchant-delivery-miss-rider-orders-result

    const orderIds = orders.map((item) => item.id);
    const transfers = orderIds.length
      ? await OrderTransfer.findAll({
          where: { order_id: { [Op.in]: orderIds } },
          include: [
            { model: User, as: 'fromUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
            { model: User, as: 'toUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] },
            { model: User, as: 'revokedByUser', attributes: ['id', 'nickname', 'phone', 'rider_kind', 'rider_level', 'delivery_scope', 'town_name', 'rider_town'] }
          ],
          order: [['id', 'DESC']]
        })
      : [];
    const transferMap = new Map();
    transfers.forEach((item) => {
      const serialized = serializeTransferRecord(item);
      const existing = transferMap.get(item.order_id) || [];
      existing.push(serialized);
      transferMap.set(item.order_id, existing);
    });

    const normalized = orders.map((o) => {
      const plain = o.get({ plain: true });

      let address = plain.delivery_address;
      if (typeof address === 'string') {
        try {
          const addrObj = JSON.parse(address);
          address =
            addrObj?.detail ||
            addrObj?.address ||
            addrObj?.street ||
            addrObj?.town ||
            addrObj?.district ||
            addrObj?.city ||
            addrObj?.province ||
            address;
        } catch (e) {}
      } else if (address && typeof address === 'object') {
        address = address.detail || address.address || JSON.stringify(address);
      }

      const latitude =
        plain.delivery_latitude === null || plain.delivery_latitude === undefined
          ? (plain.customer_lat ? Number(plain.customer_lat) : null)
          : Number(plain.delivery_latitude);
      const longitude =
        plain.delivery_longitude === null || plain.delivery_longitude === undefined
          ? (plain.customer_lng ? Number(plain.customer_lng) : null)
          : Number(plain.delivery_longitude);

      const enriched = appendTransferMetaToOrder({
        currentUser: user,
        transferChain: transferMap.get(plain.id) || [],
        plain: {
        ...plain,
        address,
        latitude,
        longitude,
        // 兼容骑手端所需的各种导航字段（全部转为Number类型防报错）
        merchantLng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchantLat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        merchant_lng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchant_lat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        customer_lng: longitude,
        customer_lat: latitude,
        }
      });

      return {
        ...enriched,
        ...buildDeliveryOrderPresentation({
          user,
          order: enriched
        })
      };
    });

    res.json(successResponse(normalized));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新骑手状态（接单中/休息）
 * 骑手切换在线 / 休息状态时走这里。
 */
exports.updateRiderStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const { status } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    await user.update({
      rider_status: status ? 1 : 0
    });

    res.json(successResponse({
      rider_status: status ? 1 : 0
    }, '状态更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家发货（配送中）
 * 普通商家或商家自配送员把订单正式推进到配送中时，会走这个入口。
 */
exports.deliverOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const isMerchantDeliveryOperator = isMerchantDeliveryUser(user);
    // 兼容驼峰和蛇形命名
    const order_id = req.body.order_id || req.body.orderId;

    const merchant = await findOperableMerchantByUser(user);
    if (!merchant) {
      return res.status(404).json(errorResponse(isMerchantDeliveryOperator ? '当前账号未绑定店铺' : '您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const ownershipError = getMerchantOrderOwnershipError(merchant, order);
    if (ownershipError) {
      return res.status(403).json(errorResponse(ownershipError));
    }

    const repairedDelivery = await repairOrderDeliveryFieldsIfNeeded(order, merchant);
    const supermarketDeliveryMode = repairedDelivery.mode;
    if (supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      const startMeta = prepareMerchantSelfDeliveryStart({
        order,
        user,
        isMerchantDeliveryOperator
      });

      await order.update(startMeta.updatePatch);

      await OrderLog.create(startMeta.logPayload);

      const refreshed = await Order.findByPk(order.id, {
        include: [{ model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] }]
      });
      socketService.notifyUserOrderUpdate(order.user_id, refreshed, startMeta.notifyMessage);
      await socketService.broadcastDispatcherOrdersUpdate();

      const refreshedPlain = refreshed?.get ? refreshed.get({ plain: true }) : refreshed;
      return res.json(successResponse({
        ...refreshedPlain,
        ...buildDeliveryOrderPresentation({
          user,
          order: refreshedPlain
        })
      }, startMeta.successMessage));
    }

    if (isMerchantDeliveryOperator) {
      return res.status(403).json(errorResponse('当前订单不是店铺自配送订单，绑定员工不能操作'));
    }

    if (Number(order.status) !== 4) {
      return res.status(400).json(errorResponse('订单状态不正确，需要先备货完成'));
    }

    if (order.rider_id) {
      return res.status(400).json(errorResponse('订单已分配骑手'));
    }

    if (order.order_type === 'county') {
      if (!order.customer_town) {
        return res.status(400).json(errorResponse('县城外卖订单缺少客户乡镇'));
      }

      await dispatchCenterService.pushOrderToDispatchCenter({ order, merchant });

      await order.update({
        dispatch_center_status: 'sent',
        dispatch_center_order_id: String(order.id),
        dispatch_sent_at: new Date()
      });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'merchant',
        action: '提交调度中心',
        from_status: 4,
        to_status: 4,
        remark: '县城外卖已提交调度中心派单'
      });

      socketService.notifyDispatcherReminder(order, {
        eventType: 'dispatcher_order_ready',
        title: '新待派订单',
        message: `订单 ${order.order_no} 已进入调度待派`,
        speechText: '有新的县城待派订单，请及时派单',
        soundType: 'dispatcher_pending_order',
        priority: 'high',
        jumpType: 'dispatch_order',
        jumpPath: '/dispatch/orders',
        dedupeKey: `dispatcher_order_ready:${order.id}`,
        extra: {
          merchant_name: merchant?.name || '',
          customer_town: order.customer_town || ''
        }
      });
      await socketService.broadcastDispatcherOrdersUpdate();

      return res.json(successResponse(order, '已提交调度中心'));
    }

    if (order.order_type === 'town') {
      const fromStatus = Number(order.status);
      await order.update({
        dispatch_center_status: 'town_pending_accept',
        rider_id: null,
        current_responsible_user_id: null,
        current_responsible_role: null
      });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'merchant',
        action: '开放乡镇骑手接单',
        from_status: fromStatus,
        to_status: fromStatus,
        remark: '商家已出餐，等待乡镇骑手接单'
      });

      const refreshed = await Order.findByPk(order.id, {
        include: [{ model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] }]
      });

      socketService.notifyUserOrderUpdate(order.user_id, refreshed, '商家已出餐，等待乡镇骑手接单');
      await socketService.broadcastDispatcherOrdersUpdate();

      return res.json(successResponse(refreshed, '已进入乡镇待接单池'));
    }

    const rider = await riderDispatchService.selectRiderForMerchant(merchant);
    if (!rider) {
      return res.status(400).json(errorResponse('暂无可用骑手'));
    }

    const fromStatus = order.status;
    await order.update({
      rider_id: rider.id,
      status: 5,
      current_responsible_user_id: rider.id,
      current_responsible_role: 'county_rider'
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '分配骑手',
      from_status: fromStatus,
      to_status: 5,
      remark: `已分配：${rider.nickname || rider.phone || rider.id}`
    });

    const refreshed = await Order.findByPk(order.id, {
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
        { model: User, as: 'rider', attributes: ['nickname', 'phone'] }
      ]
    });

    socketService.notifyRiderNewOrder(rider.id, refreshed);
    socketService.notifyUserOrderUpdate(order.user_id, refreshed, '骑手已接单，正在配送中');
    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(refreshed, '已派单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 发布跑腿订单
 */
/**
 * 发布跑腿单
 * 用户发布普通跑腿需求时走这里。
 */
exports.publishErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      pickup_address,
      delivery_address,
      item_type,
      expected_time,
      reward,
      remark
    } = req.body;

    // 生成订单号
    const order_no = generateOrderNo();

    const order = await Order.create({
      order_no,
      order_id: order_no,
      user_id: user.id,
      type: 'errand',
      status: 1, // 待接单
      errand_type: item_type,
      errand_description: remark,
      items_json: '[]',
      delivery_address: JSON.stringify(delivery_address),
      rider_fee: reward || 0,
      pay_amount: reward || 0,
      remark: `取件地址: ${pickup_address}, 期望送达: ${expected_time}`
    });

    res.status(201).json(successResponse(order, '跑腿订单发布成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取跑腿订单列表
 */
/**
 * 获取跑腿单列表
 * 骑手端或相关角色查看待接跑腿单时，会走这个接口。
 */
exports.getErrandList = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const where = { type: 'errand' };
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 骑手接跑腿订单
 */
/**
 * 接跑腿单
 * 骑手确认接下某一笔跑腿单时走这里。
 */
exports.acceptErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以接单'));
    }

    const acceptedOrder = await sequelize.transaction(async (t) => {
      const order = await Order.findOne({
        where: { id: order_id, type: 'errand' },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!order) {
        const err = new Error('订单不存在');
        err.statusCode = 404;
        throw err;
      }

      if (Number(order.status) !== 1 || order.rider_id) {
        const err = new Error('订单已被其他骑手接走，请刷新列表');
        err.statusCode = 400;
        throw err;
      }

      const fromStatus = Number(order.status);
      await order.update({
        rider_id: user.id,
        status: 5
      }, { transaction: t });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'rider',
        action: '接跑腿订单',
        from_status: fromStatus,
        to_status: 5,
        remark: '骑手已接单'
      }, { transaction: t });

      return order;
    });

    res.json(successResponse(acceptedOrder, '接单成功'));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message));
    }
    next(error);
  }
};

/**
 * 完成跑腿订单
 */
/**
 * 完成跑腿单
 * 跑腿任务完成后，推进状态、记日志、结算收入都在这里处理。
 */
exports.completeErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const order = await Order.findOne({
      where: { id: order_id, rider_id: user.id, type: 'errand' }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (Number(order.status) !== 5) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 6, // 已完成
      delivered_at: new Date()
    });

    // 更新骑手余额
    await user.increment('rider_balance', { by: order.rider_fee || 0 });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'rider',
      action: '完成跑腿订单',
      from_status: fromStatus,
      to_status: 6,
      remark: '跑腿订单已完成'
    });

    res.json(successResponse(order, '订单已完成'));
  } catch (error) {
    next(error);
  }
};
