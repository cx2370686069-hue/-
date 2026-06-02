// 这个文件是“配送域公共常量表”。
// 配送相关的域、身份、动作、责任角色、默认状态文案，统一从这里出，避免各文件写出不同口径。
const DELIVERY_DOMAINS = {
  PLATFORM_DELIVERY: 'platform_delivery',
  COUNTY_DISPATCH: 'county_dispatch',
  TOWN_NATIVE_DELIVERY: 'town_native_delivery',
  COUNTY_TO_TOWN_TRANSFER: 'county_to_town_transfer',
  SELF_DELIVERY: 'self_delivery'
};

const DELIVERY_IDENTITIES = {
  COUNTY_RIDER: 'county_rider',
  TOWN_STATIONMASTER: 'town_stationmaster',
  TOWN_RIDER: 'town_rider',
  MERCHANT_SELF_DELIVERY: 'merchant_self_delivery',
  SUPERMARKET_SELF_DELIVERY: 'supermarket_self_delivery',
  WHOLESALE_SELF_DELIVERY: 'wholesale_self_delivery'
};

const DELIVERY_ACTIONS = {
  PICKUP: 'pickup',
  START_DELIVERY: 'start_delivery',
  COMPLETE_DELIVERY: 'complete_delivery',
  SPECIAL_COMPLETE: 'special_complete',
  NAVIGATE_PICKUP: 'navigate_pickup',
  NAVIGATE_DELIVERY: 'navigate_delivery',
  TRANSFER_ORDER: 'transfer_order',
  REVOKE_TRANSFER: 'revoke_transfer'
};

const DELIVERY_RESPONSIBLE_ROLES = {
  COUNTY_RIDER: 'county_rider',
  RIDER: 'rider',
  MERCHANT_DELIVERY: 'merchant_delivery',
  TOWN_STATIONMASTER: 'town_stationmaster',
  TOWN_RIDER: 'town_rider'
};

// 送达距离校验开关现在默认关着；如果以后要开启近距离送达校验，就改这里。
const DELIVERY_CONFIRM_DISTANCE_LIMIT_KM = 0.8;
const DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS = 800;
const DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED = false;

const DEFAULT_STATUS_TEXT_MAP = {
  0: '待付款',
  1: '待接单',
  2: '备餐中',
  3: '待配送',
  4: '骑手已接单',
  5: '配送中',
  6: '已完成',
  7: '已取消'
};

// 配送域里统一用这个工厂造业务错误，方便控制器层拿到 statusCode。
const createDeliveryError = (message, statusCode = 400, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

module.exports = {
  DELIVERY_DOMAINS,
  DELIVERY_IDENTITIES,
  DELIVERY_ACTIONS,
  DELIVERY_RESPONSIBLE_ROLES,
  DELIVERY_CONFIRM_DISTANCE_LIMIT_KM,
  DELIVERY_CONFIRM_DISTANCE_LIMIT_METERS,
  DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED,
  DEFAULT_STATUS_TEXT_MAP,
  createDeliveryError
};
