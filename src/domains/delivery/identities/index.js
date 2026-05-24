const {
  DELIVERY_DOMAINS,
  DELIVERY_IDENTITIES
} = require('../shared/constants');

// 这个文件是“配送身份解析入口”。
// 同样是送单账号，系统里还要继续分：
// - 平台骑手
// - 乡镇站长
// - 乡镇骑手
// - 商家自配送员
// 后面可见范围、可操作按钮、状态文案，都会先看这里识别出来的身份。
const normalizeText = (value) => String(value || '').trim();

// ==================== 骑手范围识别区 ====================
const resolveRiderScope = (user = {}) => {
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

// 乡镇站长本质上也是 rider(骑手角色)，只是配送范围和管理职责更高一层。
const isTownStationmasterUser = (user = {}) => {
  if (user.role !== 'rider') {
    return false;
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'town_delivery') {
    return false;
  }

  return user.rider_kind === 'stationmaster' || user.rider_level === 'captain';
};

// ==================== 自配送身份识别区 ====================
// 商家自配送也分普通门店、超市、批发等细分身份，后面状态展示和规则会跟着变。
const resolveSelfDeliveryIdentity = ({ merchantCategory, order } = {}) => {
  const rawCategory =
    normalizeText(merchantCategory) ||
    normalizeText(order?.merchant?.category) ||
    normalizeText(order?.merchant_category);

  if (rawCategory.includes('超市')) {
    return DELIVERY_IDENTITIES.SUPERMARKET_SELF_DELIVERY;
  }

  if (rawCategory.includes('批发')) {
    return DELIVERY_IDENTITIES.WHOLESALE_SELF_DELIVERY;
  }

  return DELIVERY_IDENTITIES.MERCHANT_SELF_DELIVERY;
};

// ==================== 对外统一身份入口 ====================
const resolveDeliveryIdentity = ({ user = {}, merchantCategory = null, order = null } = {}) => {
  const accountRole = normalizeText(user.role);

  if (accountRole === 'merchant_delivery') {
    const deliveryIdentity = resolveSelfDeliveryIdentity({ merchantCategory, order });
    return {
      accountRole,
      deliveryDomain: DELIVERY_DOMAINS.SELF_DELIVERY,
      deliveryIdentity,
      riderScope: null,
      isDeliveryAccount: true,
      isPlatformDelivery: false,
      isSelfDelivery: true
    };
  }

  if (accountRole !== 'rider') {
    return {
      accountRole,
      deliveryDomain: null,
      deliveryIdentity: null,
      riderScope: null,
      isDeliveryAccount: false,
      isPlatformDelivery: false,
      isSelfDelivery: false
    };
  }

  const riderScope = resolveRiderScope(user);
  const deliveryIdentity =
    riderScope.delivery_scope === 'town_delivery'
      ? (isTownStationmasterUser(user)
          ? DELIVERY_IDENTITIES.TOWN_STATIONMASTER
          : DELIVERY_IDENTITIES.TOWN_RIDER)
      : DELIVERY_IDENTITIES.COUNTY_RIDER;

  return {
    accountRole,
    deliveryDomain: DELIVERY_DOMAINS.PLATFORM_DELIVERY,
    deliveryIdentity,
    riderScope,
    isDeliveryAccount: true,
    isPlatformDelivery: true,
    isSelfDelivery: false
  };
};

// 给别的模块一个快速判断：当前身份是不是“商家自配送体系”。
const isSelfDeliveryIdentity = (identity) => [
  DELIVERY_IDENTITIES.MERCHANT_SELF_DELIVERY,
  DELIVERY_IDENTITIES.SUPERMARKET_SELF_DELIVERY,
  DELIVERY_IDENTITIES.WHOLESALE_SELF_DELIVERY
].includes(identity);

module.exports = {
  resolveRiderScope,
  isTownStationmasterUser,
  resolveSelfDeliveryIdentity,
  resolveDeliveryIdentity,
  isSelfDeliveryIdentity
};
