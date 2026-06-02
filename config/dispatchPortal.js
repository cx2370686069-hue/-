// 这个文件专门统一“调度端落户口”规则。
// 这次只解决一个问题：商家注册/建店后，后续订单到底该落到调度端的哪一个入口。
// 入口只允许 3 种：县城、乡镇、商家自配送。
const {
  SUPERMARKET_DELIVERY_PERMISSIONS,
  SUPERMARKET_DELIVERY_MODES,
  normalizeSupermarketDeliveryPermission,
  normalizeSupermarketDeliveryMode
} = require('./supermarketDelivery');

const DISPATCH_PORTALS = {
  COUNTY: 'county',
  TOWN: 'town',
  MERCHANT: 'merchant'
};

const normalizeDispatchPortal = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (['county', 'county_dispatch', '县城'].includes(text)) {
    return DISPATCH_PORTALS.COUNTY;
  }
  if (['town', 'town_dispatch', '乡镇'].includes(text)) {
    return DISPATCH_PORTALS.TOWN;
  }
  if (
    ['merchant', 'merchant_self', 'self_delivery', 'merchant_delivery', '自配送', '商家自配送'].includes(text)
  ) {
    return DISPATCH_PORTALS.MERCHANT;
  }
  return null;
};

// 商家落到哪个调度入口，优先按商家业务线和配送权限来定。
// 这里故意不看订单实时状态，因为你要的是“注册/建店即落户”，不是配送中再临时猜。
const resolveMerchantDispatchPortal = ({ businessScope, supermarketDeliveryPermission } = {}) => {
  const normalizedScope = String(businessScope || '').trim().toLowerCase();
  const normalizedPermission = normalizeSupermarketDeliveryPermission(supermarketDeliveryPermission);

  if (normalizedScope === 'town_food') {
    return DISPATCH_PORTALS.TOWN;
  }
  if (normalizedPermission === SUPERMARKET_DELIVERY_PERMISSIONS.SELF_ONLY) {
    return DISPATCH_PORTALS.MERCHANT;
  }
  return DISPATCH_PORTALS.COUNTY;
};

// 订单侧优先用下单时写死的快照。
// 老订单如果还没有快照，再按订单自身字段兜底反推，保证这次上线后历史数据也不至于全丢视角。
const resolveOrderDispatchPortal = ({ order, merchant } = {}) => {
  const snapshotPortal = normalizeDispatchPortal(
    order?.dispatch_portal_snapshot ?? order?.dispatch_portal ?? order?.dispatchPortalSnapshot ?? order?.dispatchPortal
  );
  if (snapshotPortal) {
    return snapshotPortal;
  }

  const deliveryMode = normalizeSupermarketDeliveryMode(order?.supermarket_delivery_mode);
  if (deliveryMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
    return DISPATCH_PORTALS.MERCHANT;
  }

  const currentDomain = String(order?.current_delivery_domain || '').trim().toLowerCase();
  if (currentDomain === 'self_delivery') {
    return DISPATCH_PORTALS.MERCHANT;
  }

  const orderType = String(order?.order_type || '').trim().toLowerCase();
  if (orderType === 'town') {
    return DISPATCH_PORTALS.TOWN;
  }
  if (orderType === 'county') {
    return DISPATCH_PORTALS.COUNTY;
  }

  if (merchant) {
    return resolveMerchantDispatchPortal({
      businessScope: merchant.business_scope,
      supermarketDeliveryPermission: merchant.supermarket_delivery_permission
    });
  }

  return DISPATCH_PORTALS.COUNTY;
};

module.exports = {
  DISPATCH_PORTALS,
  normalizeDispatchPortal,
  resolveMerchantDispatchPortal,
  resolveOrderDispatchPortal
};
