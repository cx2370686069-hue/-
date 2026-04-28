const crypto = require('crypto');
const { Order, OrderLog, Merchant, Product, ProductSpec, User, CountyOrderGroup, CartItem, Review, Refund, sequelize } = require('../models');
const { generateOrderNo, successResponse, errorResponse } = require('../utils/helpers');
const { round2, normalizePayChannel, computeDeliveryFee, computeTakeoutSettlement } = require('../utils/payment');
const paymentService = require('../services/paymentService');
const riderDispatchService = require('../services/riderDispatchService');
const dispatchCenterService = require('../services/dispatchCenterService');
const socketService = require('../services/socketService');
const routePlanningService = require('../services/routePlanningService');
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

const SUPERMARKET_CATEGORY = '超市';
const COUNTY_GROUP_EXTRA_STORE_FEE = 1;

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

const findOwnedMerchantByUserId = async (userId) => {
  return Merchant.findOne({ where: { user_id: userId } });
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

const buildRiderOwnedOrderWhere = (user) => {
  const scope = resolveRiderScope(user);
  const where = { rider_id: user.id };

  if (scope.delivery_scope === 'town_delivery') {
    where.order_type = 'town';
    if (scope.town_name) {
      where.customer_town = scope.town_name;
    }
    return where;
  }

  where.order_type = 'county';
  return where;
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
      return {
        deliveryFee: 100,
        distanceKm: null,
        calculationMode: 'cross_town_penalty'
      };
    }

    const routeResult = await estimateTownRouteDeliveryFee({
      merchant,
      customerLng,
      customerLat
    });

    return {
      deliveryFee: routeResult.deliveryFee,
      distanceKm: routeResult.distanceKm,
      calculationMode: 'tianditu_drive_route'
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
    calculationMode: 'tianditu_drive_route'
  };
};

const normalizeSpecText = (value) => String(value || '').trim();

const isSupermarketMerchant = (merchant) =>
  normalizeMerchantCategory(merchant?.category) === SUPERMARKET_CATEGORY;

const resolveMerchantSupermarketDeliveryPermission = (merchant) =>
  normalizeSupermarketDeliveryPermission(merchant?.supermarket_delivery_permission);

const resolveOrderSupermarketDeliveryMode = (order) =>
  normalizeSupermarketDeliveryMode(order?.supermarket_delivery_mode);

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

    const routeResult = await estimateCountyRouteDeliveryFee({
      merchant,
      customerLng,
      customerLat
    });

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

/**
 * 创建订单（用户端）
 */
exports.createOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      merchant_id,
      type = 'takeout',
      order_type,
      customer_town,
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
      remark
    } = req.body;

    // 参数验证
    if (!merchant_id || !products_info || !total_amount) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }

    // 验证商家是否存在
    const merchant = await Merchant.findByPk(merchant_id);
    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    if (merchant.status !== 1 || Number(merchant.audit_status) !== 1) {
      return res.status(400).json(errorResponse('商家当前不可下单'));
    }

    const supermarketDeliveryPermission = isSupermarketMerchant(merchant)
      ? resolveMerchantSupermarketDeliveryPermission(merchant)
      : null;
    if (isSupermarketMerchant(merchant) && !supermarketDeliveryPermission) {
      return res.status(400).json(errorResponse('超市商家暂未配置配送方式，请联系平台'));
    }

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

    // 服务端按 DB 真实价格重算外卖类订单的商品总金额，禁止前端篡改
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

      // 与前端提交值比对，差异超 1 分则拒绝（前端必须传正确金额，避免误下单）
      if (Math.abs(round2(total_amount) - serverGoodsAmount) > 0.01) {
        return res.status(400).json(errorResponse(
          `商品金额校验失败：前端 ${round2(total_amount)} 与服务端 ${serverGoodsAmount} 不一致，请刷新购物车重试`
        ));
      }
    }

    // 优惠金额必须为非负，且不得超过商品金额，避免出现负总价
    const safeDiscountAmount = Math.max(0, Math.min(round2(discount_amount), serverGoodsAmount));
    // 包装费必须为非负
    const safePackageFee = Math.max(0, round2(package_fee));

    const { lng: finalCustomerLng, lat: finalCustomerLat, addressPayload } = resolveCustomerCoordinates(req.body);
    const resolvedOrderType = resolveOrderTypeByMerchant(merchant, order_type);
    const resolvedCustomerTown = resolveCustomerTownName({
      customerTown: customer_town,
      addressPayload,
      merchant
    });

    if (Number(delivery_type) === 1 && (finalCustomerLng === null || finalCustomerLat === null)) {
      return res.status(400).json(errorResponse('下单失败：缺少客户坐标，请重新选点'));
    }

    const deliveryEstimate = await estimateDeliveryFeeByContext({
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

    // 生成订单号
    const order_no = generateOrderNo();
    const items_json =
      typeof normalizedProductsInfo === 'object'
        ? JSON.stringify(normalizedProductsInfo)
        : (normalizedProductsInfo || '[]');
    const deliveryAddressStr =
      typeof delivery_address === 'object' ? JSON.stringify(delivery_address) : (delivery_address || '');
    const address = (deliveryAddressStr || '未填写地址').slice(0, 200);

    // 创建订单
    const order = await Order.create({
      order_no,
      order_id: order_no,
      user_id: user.id,
      merchant_id,
      type,
      order_type: resolvedOrderType,
      customer_town: resolvedCustomerTown,
      products_info: items_json,
      items_json,
      total_amount: serverGoodsAmount,
      delivery_fee: computedDeliveryFee,
      package_fee: safePackageFee,
      discount_amount: safeDiscountAmount,
      pay_amount,
      total_price: Number(pay_amount),
      delivery_type,
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
  try {
    const {
      merchant_id,
      order_type,
      customer_town,
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

    if (Number(delivery_type) === 1 && (finalCustomerLng === null || finalCustomerLat === null)) {
      return res.status(400).json(errorResponse('缺少客户坐标，无法预估配送费'));
    }

    const deliveryEstimate = await estimateDeliveryFeeByContext({
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
      delivery_type: Number(delivery_type),
      calculation_mode: deliveryEstimate.calculationMode,
      route_distance_km: deliveryEstimate.distanceKm,
      delivery_fee: deliveryEstimate.deliveryFee
    }, '配送费预估成功'));
  } catch (error) {
    next(error);
  }
};

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
        attributes: ['nickname', 'phone', 'avatar']
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
        attributes: ['nickname', 'phone', 'avatar']
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
    } else if (order.user_id !== user.id && order.rider_id !== user.id) {
      console.error(
        `[order.detail.403] token_user_id=${user.id} mapped_merchant_id=${mappedMerchantId} request_order_id=${id} order_merchant_id=${order.merchant_id}`
      );
      return res.status(403).json(errorResponse('没有权限查看'));
    }

    const detail = {
      id: order.id,
      order_no: order.order_no,
      status: order.status,
      created_at: order.created_at,
      delivery_time: order.delivered_at || order.paid_at || null,
      contact_name: order.contact_name,
      contact_phone: order.contact_phone,
      delivery_address: order.delivery_address,
      products_info: order.products_info,
      pay_amount: order.pay_amount,
      total_amount: order.total_amount,
      merchant_id: order.merchant_id,
      supermarket_delivery_permission_snapshot: order.supermarket_delivery_permission_snapshot || null,
      supermarket_delivery_mode: order.supermarket_delivery_mode || null,
      settlement_rule_snapshot: order.settlement_rule_snapshot || null,
      // 补充所有可能的坐标字段，防止骑手端导航缺失参数
      merchant_lng: Number(order.merchant_lng || order.merchant?.longitude || 0) || null,
      merchant_lat: Number(order.merchant_lat || order.merchant?.latitude || 0) || null,
      customer_lng: Number(order.customer_lng || order.delivery_longitude || 0) || null,
      customer_lat: Number(order.customer_lat || order.delivery_latitude || 0) || null,
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
    };
    res.json(successResponse(detail));
  } catch (error) {
    next(error);
  }
};

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
exports.cancelOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, reason } = req.body;

    const order = await Order.findOne({
      where: { id: order_id, user_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (![0, 1].includes(order.status)) {
      return res.status(400).json(errorResponse('当前状态不能取消'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 7,
      cancel_reason: reason
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'user',
      action: '取消订单',
      from_status: fromStatus,
      to_status: 7,
      remark: reason
    });

    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(order, '订单已取消'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家接单
 */
exports.acceptOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { merchant_lng, merchant_lat } = req.body;
    // 兼容驼峰和蛇形命名
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
      // 强制使用商家真实坐标兜底，废弃前端传的假坐标
      merchant_lng: Number(merchant.longitude) || merchant_lng || null,
      merchant_lat: Number(merchant.latitude) || merchant_lat || null
    };
    
    await order.update(updateData);

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

    if (order.status !== 1) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 7,
      cancel_reason: reason
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '拒单',
      from_status: fromStatus,
      to_status: 7,
      remark: reason
    });

    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(order, '已拒单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家备货完成/发货 (状态推进: 2 -> 3)
 */
exports.prepareOrder = async (req, res, next) => {
  try {
    const user = req.user;
    // 兼容驼峰和蛇形命名
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

    const supermarketDeliveryMode = resolveOrderSupermarketDeliveryMode(order);
    if (
      isSupermarketMerchant(merchant) &&
      order.supermarket_delivery_permission_snapshot === SUPERMARKET_DELIVERY_PERMISSIONS.HYBRID &&
      supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.PENDING
    ) {
      return res.status(400).json(errorResponse('该超市订单还未选择配送方式，请先选择老板自配或骑手配送'));
    }

    const fromStatus = statusNum;
    await order.update({ status: 3 });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '备货完成',
      from_status: fromStatus,
      to_status: 3,
      remark: supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY
        ? '商家已备货完成，等待老板开始配送'
        : '商家已出餐，等待骑手取餐'
    });

    socketService.notifyUserOrderUpdate(
      order.user_id,
      order,
      supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY
        ? '商家已备货完成，老板即将配送'
        : '商家已出餐，正在呼叫骑手'
    );
    await socketService.broadcastDispatcherOrdersUpdate();

    if (supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      return res.json(successResponse(order, '备货完成，等待老板配送'));
    }

    // 尝试推给调度中心或站长
    try {
      if (order.order_type === 'town') {
        const assigned = await dispatchCenterService.assignToTownStation({ order, merchant, operatorUserId: user.id });
        if (assigned?.order) {
          order = assigned.order;
        }
      } else {
        await dispatchCenterService.pushOrderToDispatchCenter({ order, merchant });
      }
    } catch (e) {
      console.error('推单给调度中心失败:', e);
    }

    res.json(successResponse(order, '备货完成，已通知骑手'));
  } catch (error) {
    next(error);
  }
};

/**
 * 骑手取餐完成 (状态推进: 4 -> 5)
 */
exports.riderPickup = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const order = await Order.findOne({ where: { id: order_id, rider_id: user.id } });
    if (!order) return res.status(404).json(errorResponse('订单不存在'));

    if (order.status !== 4) {
      return res.status(400).json(errorResponse('订单当前不是骑手已接单状态'));
    }

    const fromStatus = order.status;
    await order.update({ status: 5 });

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

const completeRiderOrder = async ({
  order,
  user,
  action,
  remark,
  notifyMessage,
  successMessage
}) => {
  await sequelize.transaction(async (t) => {
    const fromStatus = Number(order.status);
    await order.update(
      {
        status: 6,
        delivered_at: new Date(),
        settled_at: new Date()
      },
      { transaction: t }
    );

    await user.increment('rider_balance', { by: Number(order.rider_fee || 0), transaction: t });

    const merchant = await Merchant.findByPk(order.merchant_id, { transaction: t });
    if (merchant) {
      const merchantIncome = Number(order.merchant_income_amount || 0);
      if (merchantIncome > 0) {
        await merchant.increment(
          { balance: merchantIncome, total_income: merchantIncome },
          { transaction: t }
        );
      }
    }

    await OrderLog.create(
      {
        order_id: order.id,
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
  await socketService.broadcastDispatcherOrdersUpdate();
  return successResponse(refreshed, successMessage);
};

const completeMerchantSelfDeliveryOrder = async ({
  order,
  merchant,
  operatorUserId,
  action,
  remark,
  notifyMessage,
  successMessage
}) => {
  await sequelize.transaction(async (t) => {
    const fromStatus = Number(order.status);
    await order.update(
      {
        status: 6,
        delivered_at: new Date(),
        settled_at: new Date()
      },
      { transaction: t }
    );

    const merchantIncome = Number(order.merchant_income_amount || 0);
    if (merchantIncome > 0) {
      await merchant.increment(
        { balance: merchantIncome, total_income: merchantIncome },
        { transaction: t }
      );
    }

    await OrderLog.create(
      {
        order_id: order.id,
        operator_id: operatorUserId || merchant.user_id || null,
        operator_type: 'merchant',
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
  await socketService.broadcastDispatcherOrdersUpdate();
  return successResponse(refreshed, successMessage);
};

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
      return res.status(400).json(errorResponse('请选择有效的超市配送方式'));
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

    if (!isSupermarketMerchant(merchant)) {
      return res.status(400).json(errorResponse('只有超市订单才需要选择该配送方式'));
    }

    if (order.supermarket_delivery_permission_snapshot !== SUPERMARKET_DELIVERY_PERMISSIONS.HYBRID) {
      return res.status(400).json(errorResponse('当前店铺不是“双模式”超市，不能逐单切换配送方式'));
    }

    if (![1, 2].includes(Number(order.status))) {
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
      action: '选择超市配送方式',
      from_status: Number(order.status),
      to_status: Number(order.status),
      remark: selectedMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY ? '本单改为老板自配' : '本单改为骑手配送'
    });

    const refreshed = await Order.findByPk(order.id);
    res.json(successResponse(refreshed, '配送方式已锁定'));
  } catch (error) {
    next(error);
  }
};

exports.confirmMerchantSelfDelivery = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.body.order_id || req.body.orderId;
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

    if (resolveOrderSupermarketDeliveryMode(order) !== SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      return res.status(400).json(errorResponse('当前订单不是老板自配，不能由商家直接完结'));
    }

    if (Number(order.status) !== 5) {
      return res.status(400).json(errorResponse('当前订单还未进入老板配送中状态'));
    }

    const response = await completeMerchantSelfDeliveryOrder({
      order,
      merchant,
      operatorUserId: user.id,
      action: '老板自配送送达',
      remark: '商家自配送已完成',
      notifyMessage: '订单已由商家送达',
      successMessage: '自配送订单已完成'
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};


/**
 * 骑手确认送达
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

    if (Number(order.status) !== 5) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const response = await completeRiderOrder({
      order,
      user,
      action: '确认送达',
      remark: '骑手正常送达完成',
      notifyMessage: '订单已送达',
      successMessage: '送达成功'
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};

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

exports.getAvailableOrders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const where = buildRiderOwnedOrderWhere(user);
    where.status = { [Op.in]: [5, 6] };

    const orders = await Order.findAll({
      where,
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
        { model: User, as: 'user', attributes: ['nickname', 'phone'] }
      ],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的配送订单（骑手端）
 */
exports.getRiderOrders = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const { status } = req.query;
    const where = buildRiderOwnedOrderWhere(user);
    if (status) where.status = status;

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

      return {
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
      };
    });

    res.json(successResponse(normalized));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新骑手状态（接单中/休息）
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
 */
exports.deliverOrder = async (req, res, next) => {
  try {
    const user = req.user;
    // 兼容驼峰和蛇形命名
    const order_id = req.body.order_id || req.body.orderId;

    const merchant = await findOwnedMerchantByUserId(user.id);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
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

    const supermarketDeliveryMode = resolveOrderSupermarketDeliveryMode(order);
    if (supermarketDeliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
      if (Number(order.status) !== 3) {
        return res.status(400).json(errorResponse('老板自配订单需要先备货完成后再开始配送'));
      }

      const fromStatus = Number(order.status);
      await order.update({
        status: 5,
        rider_id: null,
        dispatch_center_status: 'self_delivery'
      });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'merchant',
        action: '老板开始配送',
        from_status: fromStatus,
        to_status: 5,
        remark: '该超市订单进入老板自配送中'
      });

      const refreshed = await Order.findByPk(order.id, {
        include: [{ model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] }]
      });
      socketService.notifyUserOrderUpdate(order.user_id, refreshed, '老板正在为您配送');
      await socketService.broadcastDispatcherOrdersUpdate();

      return res.json(successResponse(refreshed, '已进入老板自配送'));
    }

    if (order.status !== 4) {
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

      await socketService.broadcastDispatcherOrdersUpdate();

      return res.json(successResponse(order, '已提交调度中心'));
    }

    let rider = null;
    if (order.order_type === 'town' && order.customer_town) {
      rider = await User.findOne({
        where: {
          role: 'rider',
          status: 1,
          rider_kind: 'stationmaster',
          rider_town: order.customer_town
        }
      });
    }

    if (!rider) {
      rider = await riderDispatchService.selectRiderForMerchant(merchant);
    }

    if (!rider) {
      return res.status(400).json(errorResponse('暂无可用骑手'));
    }

    const fromStatus = order.status;
    await order.update({
      rider_id: rider.id,
      status: 5
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: order.order_type === 'town' ? '分配站长' : '分配骑手',
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
      user_id: user.id,
      type: 'errand',
      status: 1, // 待接单
      errand_type: item_type,
      errand_description: remark,
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
exports.acceptErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以接单'));
    }

    const order = await Order.findOne({
      where: { id: order_id, type: 'errand' }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 1) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      rider_id: user.id,
      status: 5 // 配送中
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'rider',
      action: '接跑腿订单',
      from_status: fromStatus,
      to_status: 5,
      remark: '骑手已接单'
    });

    res.json(successResponse(order, '接单成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 完成跑腿订单
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

    if (order.status !== 5) {
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
