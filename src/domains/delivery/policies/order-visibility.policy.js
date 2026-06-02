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
// 乡镇名是这条链路里最容易出“有语音、没列表”的地方。
// 实时推送那边已经做了归一化，会把“郭陆滩 / 郭陆滩镇 / 固始县郭陆滩镇”当成同一个乡镇。
// 但列表查询之前还是按原始字符串精确匹配，结果就是：
// - socket 能判断“这是同乡镇”，所以语音照样播
// - SQL 却因为 customer_town 和 rider.town_name 写法不同，把订单查空
// 这里统一补一套和实时推送接近的归一化 + 候选值逻辑，让两边口径一致。
const normalizeTownName = (value) => String(value || '')
  .replace(/\s+/g, '')
  .replace(/^河南省/, '')
  .replace(/^信阳市/, '')
  .replace(/^固始县/, '')
  .replace(/(街道办事处|办事处|街道|镇|乡)$/u, '')
  .trim();

const buildTownNameCandidates = (value) => {
  const raw = String(value || '').trim();
  const normalized = normalizeTownName(raw);
  const candidates = new Set();

  if (raw) {
    candidates.add(raw);
  }
  if (normalized) {
    candidates.add(normalized);
    candidates.add(`${normalized}镇`);
    candidates.add(`${normalized}乡`);
    candidates.add(`固始县${normalized}`);
    candidates.add(`固始县${normalized}镇`);
    candidates.add(`固始县${normalized}乡`);
    candidates.add(`信阳市固始县${normalized}`);
    candidates.add(`信阳市固始县${normalized}镇`);
    candidates.add(`信阳市固始县${normalized}乡`);
  }

  return Array.from(candidates).filter(Boolean);
};

const buildTownWhere = (townName) => {
  const candidates = buildTownNameCandidates(townName);
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  return { [Op.in]: candidates };
};

const isSameTown = (left, right) => {
  const normalizedLeft = normalizeTownName(left);
  const normalizedRight = normalizeTownName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

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
    const townWhere = buildTownWhere(scope.town_name);
    if (townWhere) {
      where.customer_town = townWhere;
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

  const townWhere = buildTownWhere(scope.town_name);

  const visibleOr = [
    {
      order_type: 'town',
      customer_town: townWhere,
      rider_id: user.id
    },
    {
      order_type: 'town',
      customer_town: townWhere,
      rider_id: null,
      // 乡镇骑手池从“商家已接单”开始才对骑手可见。
      // 也就是说，status=1 的纯用户下单阶段先不要放给骑手看，
      // 避免商家还没接单，骑手端就提前出现一笔还没确认要做的单。
      status: { [Op.in]: [2, 3, 4] }
    },
    {
      is_transfer_order: true,
      current_responsible_user_id: user.id
    },
    {
      order_type: 'town',
      customer_town: townWhere,
      current_responsible_role: 'town_stationmaster',
      status: { [Op.in]: [2, 3, 4, 5] }
    }
  ];

  if (isTownStationmasterUser(user)) {
    visibleOr.push({
      order_type: 'town',
      customer_town: townWhere,
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
      (!scope.town_name || !targetTownName || isSameTown(scope.town_name, targetTownName))
    ) {
      return true;
    }
  }

  const scope = resolveRiderScope(user);
  if (scope.delivery_scope !== 'town_delivery') {
    return false;
  }

  const targetTownName = normalizeTownName(order.transfer_to_town_name || order.customer_town);
  const canViewTownPoolOrder =
    // 这里补的是“乡镇未接单池”的详情查看权限。
    // 原来列表页已经允许同乡镇骑手/站长看到这些待接单、备货中的订单，
    // 但详情权限没有同步放开，结果就是列表能点，详情却被后端拦成“没有权限查看”。
    // 这里按和列表一致的口径放开：同乡镇、乡镇单、还没被具体骑手接走的池子订单，可以看详情，但不代表可以直接操作。
    order.order_type === 'town' &&
    [2, 3, 4].includes(Number(order.status)) &&
    Number(order.rider_id || 0) <= 0 &&
    Number(order.current_responsible_user_id || 0) <= 0 &&
    (!scope.town_name || !targetTownName || isSameTown(scope.town_name, targetTownName));
  const canViewStationmasterOwnedTownOrder =
    order.order_type === 'town' &&
    String(order.current_responsible_role || '') === 'town_stationmaster' &&
    [2, 3, 4, 5].includes(Number(order.status)) &&
    (!scope.town_name || !targetTownName || isSameTown(scope.town_name, targetTownName));

  return canViewTownPoolOrder || canViewStationmasterOwnedTownOrder;
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
