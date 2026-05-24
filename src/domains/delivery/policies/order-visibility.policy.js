const { Op } = require('sequelize');
const {
  SUPERMARKET_DELIVERY_MODES,
  SUPERMARKET_DELIVERY_PERMISSIONS,
  normalizeSupermarketDeliveryMode
} = require('../../../../config/supermarketDelivery');
const {
  resolveDeliveryIdentity,
  resolveRiderScope,
  isTownStationmasterUser
} = require('../identities');

// 这个文件是“配送订单可见范围策略”。
// 它解决的是“谁能看到哪一批订单”这个问题，和“能不能操作”不是同一层。
// 前者看这里，后者看 order-actions.policy.js(订单动作策略)。
const normalizeTownName = (value) => String(value || '').trim();

// ==================== 商家自配送可见范围区 ====================
const buildMerchantDeliveryVisibleOrderWhere = ({ user = {}, effectivePermission = null } = {}) => {
  const merchantId = Number(user.bound_merchant_id || 0);
  if (!merchantId) {
    return { id: -1 };
  }

  const modeConditions = [
    { supermarket_delivery_mode: SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY }
  ];

  if (effectivePermission === SUPERMARKET_DELIVERY_PERMISSIONS.SELF_ONLY) {
    modeConditions.push({ supermarket_delivery_mode: null });
  }

  return {
    merchant_id: merchantId,
    [Op.and]: [
      {
        [Op.or]: modeConditions
      },
      {
        [Op.or]: [
          {
            status: 3,
            rider_id: null,
            current_responsible_user_id: null
          },
          { rider_id: user.id },
          { current_responsible_user_id: user.id }
        ]
      }
    ]
  };
};

// ==================== 骑手自己负责订单区 ====================
const buildRiderOwnedOrderWhere = ({ user = {} } = {}) => {
  const identity = resolveDeliveryIdentity({ user });
  if (identity.isSelfDelivery) {
    return { rider_id: user.id };
  }

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

// ==================== 骑手可见订单池区 ====================
// 县城骑手、乡镇骑手、乡镇站长三类人的可见范围不同，这里统一拼 Sequelize 查询条件。
const buildRiderVisibleOrderWhere = ({ user = {} } = {}) => {
  const ownedWhere = buildRiderOwnedOrderWhere({ user });
  const scope = resolveRiderScope(user);

  if (scope.delivery_scope === 'county_delivery') {
    return {
      [Op.or]: [
        ownedWhere,
        {
          order_type: 'county',
          current_responsible_user_id: user.id
        }
      ]
    };
  }

  if (!scope.town_name) {
    return ownedWhere;
  }

  const visibleOr = [
    {
      order_type: 'town',
      customer_town: scope.town_name,
      rider_id: user.id
    },
    {
      order_type: 'town',
      customer_town: scope.town_name,
      rider_id: null,
      status: { [Op.in]: [1, 2, 3, 4] }
    },
    {
      is_transfer_order: true,
      current_responsible_user_id: user.id
    },
    {
      order_type: 'town',
      customer_town: scope.town_name,
      current_responsible_role: 'town_stationmaster',
      status: { [Op.in]: [2, 3, 4, 5] }
    }
  ];

  if (isTownStationmasterUser(user)) {
    visibleOr.push({
      order_type: 'town',
      customer_town: scope.town_name,
      is_transfer_order: true,
      transfer_from_user_id: user.id,
      current_responsible_role: 'town_rider'
    });
  }

  return { [Op.or]: visibleOr };
};

// 详情页权限会比列表更严，避免“列表能扫到一点，但详情看了不该看的数据”。
const canMerchantDeliveryViewOrderDetail = ({ user = {}, order = {} } = {}) => {
  const identity = resolveDeliveryIdentity({ user, order });
  if (!identity.isSelfDelivery) {
    return false;
  }

  if (Number(user.bound_merchant_id || 0) !== Number(order.merchant_id || 0)) {
    return false;
  }

  const supermarketDeliveryMode = normalizeSupermarketDeliveryMode(order.supermarket_delivery_mode);
  if (supermarketDeliveryMode && supermarketDeliveryMode !== SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
    return false;
  }

  if (Number(order.rider_id || 0) > 0 && Number(order.rider_id) !== Number(user.id)) {
    return false;
  }

  if (
    Number(order.current_responsible_user_id || 0) > 0 &&
    Number(order.current_responsible_user_id) !== Number(user.id)
  ) {
    return false;
  }

  return [3, 5, 6].includes(Number(order.status));
};

const canRiderViewOrderDetail = ({ user = {}, order = {} } = {}) => {
  if (Number(order.rider_id || 0) === Number(user.id || 0)) {
    return true;
  }

  if (Number(order.current_responsible_user_id || 0) === Number(user.id || 0)) {
    return true;
  }

  if (isTownStationmasterUser(user)) {
    const scope = resolveRiderScope(user);
    const targetTownName = normalizeTownName(order.transfer_to_town_name || order.customer_town);
    if (
      order.type === 'takeout' &&
      order.order_type === 'town' &&
      Boolean(order.is_transfer_order) &&
      String(order.current_responsible_role || '') === 'town_rider' &&
      Number(order.transfer_from_user_id || 0) === Number(user.id || 0) &&
      (!scope.town_name || !targetTownName || scope.town_name === targetTownName)
    ) {
      return true;
    }
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'town_delivery') {
    return false;
  }

  const targetTownName = normalizeTownName(order.transfer_to_town_name || order.customer_town);
  const canViewStationmasterOwnedTownOrder =
    order.order_type === 'town' &&
    String(order.current_responsible_role || '') === 'town_stationmaster' &&
    [2, 3, 4, 5].includes(Number(order.status)) &&
    (!scope.town_name || !targetTownName || scope.town_name === targetTownName);

  return canViewStationmasterOwnedTownOrder;
};

// 对外统一出口：先识别当前账号属于哪条配送线，再分发给对应策略。
const buildDeliveryVisibleOrderWhere = ({ user = {}, effectivePermission = null } = {}) => {
  const identity = resolveDeliveryIdentity({ user });
  if (identity.isSelfDelivery) {
    return buildMerchantDeliveryVisibleOrderWhere({ user, effectivePermission });
  }
  return buildRiderVisibleOrderWhere({ user });
};

module.exports = {
  buildMerchantDeliveryVisibleOrderWhere,
  buildRiderOwnedOrderWhere,
  buildRiderVisibleOrderWhere,
  buildDeliveryVisibleOrderWhere,
  canMerchantDeliveryViewOrderDetail,
  canRiderViewOrderDetail
};
