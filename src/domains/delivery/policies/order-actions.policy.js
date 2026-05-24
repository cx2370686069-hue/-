const {
  SUPERMARKET_DELIVERY_MODES,
  SUPERMARKET_DELIVERY_PERMISSIONS,
  normalizeSupermarketDeliveryMode,
  normalizeSupermarketDeliveryPermission
} = require('../../../../config/supermarketDelivery');
const {
  DELIVERY_ACTIONS,
  DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED,
  DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS,
  DELIVERY_DOMAINS,
  DELIVERY_IDENTITIES,
  DELIVERY_RESPONSIBLE_ROLES
} = require('../shared/constants');
const {
  resolveDeliveryIdentity,
  resolveSelfDeliveryIdentity,
  isSelfDeliveryIdentity
} = require('../identities');
const {
  resolveDeliveryStatusText
} = require('../shared/state-machine');

// 这个文件是“配送动作策略”。
// 它主要回答三个问题：
// 1. 这笔订单到底属于平台配送还是自配送
// 2. 当前查看人看到的配送身份是什么
// 3. 前端应该展示哪些按钮，比如开始配送、确认送达、导航取货
const hasValidCoordinate = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) > 0 &&
  Math.abs(Number(lng)) > 0;

// 订单自己也要先分域，不然后面同一套状态数字会被不同业务线误读。
const resolveOrderDeliveryDomain = (order = {}) => {
  const mode = normalizeSupermarketDeliveryMode(order.supermarket_delivery_mode);
  const permission = normalizeSupermarketDeliveryPermission(order.supermarket_delivery_permission_snapshot);

  if (
    mode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY ||
    (!mode && permission === SUPERMARKET_DELIVERY_PERMISSIONS.SELF_ONLY)
  ) {
    return DELIVERY_DOMAINS.SELF_DELIVERY;
  }

  return DELIVERY_DOMAINS.PLATFORM_DELIVERY;
};

// 再往下细分成具体配送身份，方便前端拿到更明确的展示标签。
const resolveOrderDeliveryIdentity = (order = {}) => {
  if (resolveOrderDeliveryDomain(order) === DELIVERY_DOMAINS.SELF_DELIVERY) {
    return resolveSelfDeliveryIdentity({ order });
  }

  const responsibleRole = String(order.current_responsible_role || '').trim();
  if (responsibleRole === DELIVERY_RESPONSIBLE_ROLES.TOWN_STATIONMASTER) {
    return DELIVERY_IDENTITIES.TOWN_STATIONMASTER;
  }
  if (responsibleRole === DELIVERY_RESPONSIBLE_ROLES.TOWN_RIDER) {
    return DELIVERY_IDENTITIES.TOWN_RIDER;
  }
  if (String(order.order_type || '').trim() === 'town') {
    return DELIVERY_IDENTITIES.TOWN_RIDER;
  }

  return DELIVERY_IDENTITIES.COUNTY_RIDER;
};

// 调度地图和订单卡片要知道“现在是谁在负责跟进这单”，这里统一产出摘要字段。
const resolveTrackingActor = (order = {}) => {
  if (String(order.current_responsible_role || '').trim()) {
    return String(order.current_responsible_role || '').trim();
  }

  if (Number(order.current_responsible_user_id || 0) > 0) {
    return 'delivery_user';
  }

  if (Number(order.rider_id || 0) > 0) {
    return DELIVERY_RESPONSIBLE_ROLES.RIDER;
  }

  if (resolveOrderDeliveryDomain(order) === DELIVERY_DOMAINS.SELF_DELIVERY) {
    return DELIVERY_RESPONSIBLE_ROLES.MERCHANT_DELIVERY;
  }

  return null;
};

// ==================== 按钮可操作策略区 ====================
const resolveAvailableDeliveryActions = ({ user = {}, order = {}, viewerIdentity = null } = {}) => {
  const identity = viewerIdentity || resolveDeliveryIdentity({ user, order });
  const actions = [];
  const status = Number(order.status);

  if (identity.isSelfDelivery || isSelfDeliveryIdentity(identity.deliveryIdentity)) {
    if (status === 3) {
      actions.push(DELIVERY_ACTIONS.START_DELIVERY);
    }
    if (status === 5) {
      actions.push(DELIVERY_ACTIONS.COMPLETE_DELIVERY);
    }
  }

  if (
    identity.isPlatformDelivery &&
    status === 5 &&
    (
      Number(order.rider_id || 0) === Number(user.id || 0) ||
      Number(order.current_responsible_user_id || 0) === Number(user.id || 0)
    )
  ) {
    actions.push(DELIVERY_ACTIONS.COMPLETE_DELIVERY);
  }

  if ([3, 4].includes(status) && hasValidCoordinate(order.merchant_lat, order.merchant_lng)) {
    actions.push(DELIVERY_ACTIONS.NAVIGATE_PICKUP);
  }
  if ([5, 6].includes(status) && hasValidCoordinate(order.customer_lat, order.customer_lng)) {
    actions.push(DELIVERY_ACTIONS.NAVIGATE_DELIVERY);
  }

  return Array.from(new Set(actions));
};

// 这是给接口返回层用的“展示数据组装器”。
// 控制器把原始订单丢进来后，这里顺手补齐状态文案、按钮列表、距离校验配置等前端要用的字段。
const buildDeliveryOrderPresentation = ({ user = {}, order = {}, viewerIdentity = null } = {}) => {
  const identity = viewerIdentity || resolveDeliveryIdentity({ user, order });
  const deliveryDomain = resolveOrderDeliveryDomain(order);
  const deliveryIdentity = resolveOrderDeliveryIdentity(order);
  const availableActions = resolveAvailableDeliveryActions({
    user,
    order,
    viewerIdentity: identity
  });

  return {
    viewer_delivery_domain: identity.deliveryDomain || null,
    viewer_delivery_identity: identity.deliveryIdentity || null,
    delivery_domain: deliveryDomain,
    delivery_identity: deliveryIdentity,
    available_actions: availableActions,
    status_text: resolveDeliveryStatusText({
      order,
      deliveryIdentity
    }),
    can_navigate_pickup: availableActions.includes(DELIVERY_ACTIONS.NAVIGATE_PICKUP),
    can_navigate_delivery: availableActions.includes(DELIVERY_ACTIONS.NAVIGATE_DELIVERY),
    requires_distance_check: DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED &&
      availableActions.includes(DELIVERY_ACTIONS.COMPLETE_DELIVERY),
    distance_check_limit_meters: DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED &&
      availableActions.includes(DELIVERY_ACTIONS.COMPLETE_DELIVERY)
      ? DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS
      : null,
    tracking_actor: resolveTrackingActor(order)
  };
};

module.exports = {
  resolveOrderDeliveryDomain,
  resolveOrderDeliveryIdentity,
  resolveAvailableDeliveryActions,
  buildDeliveryOrderPresentation
};
