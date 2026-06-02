// 这个文件是“骑手控制器”。
// 普通骑手和商家自配送员共用这套入口，主要处理乡镇绑定、位置上报、在线地图、今日统计、我的订单。
const { User, Order, Merchant, ServiceArea, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

const LOCATION_WRITE_MIN_INTERVAL_MS = 3000;
const LOCATION_SAME_POINT_SKIP_WINDOW_MS = 10000;
const MERCHANT_DELIVERY_ROLE = 'merchant_delivery';

// 乡镇字段是骑手大厅最容易“听到提醒却看不到单”的老坑：
// 历史数据里可能同时存在“郭陆滩”“郭陆滩镇”“固始县郭陆滩镇”三种写法。
// 如果列表查询还只按原始字符串硬匹配，socket 提醒能到，SQL 却会把单漏掉。
// 这里统一做一层归一化，并补一组常见候选值给查询条件复用。
const normalizeTownName = (value) =>
  String(value || '')
    .replace(/\s+/g, '')
    .replace(/固始县/g, '')
    .replace(/乡$/, '')
    .replace(/镇$/, '')
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
  }

  return Array.from(candidates).filter(Boolean);
};

// ==================== 配送身份与可见范围工具区 ====================
// 这一段负责判断骑手属于县城配送、乡镇配送还是商家自配送，并据此收口可见订单范围。
const resolveRiderScope = (user) => {
  const resolvedTownName = normalizeTownName(user.town_name || user.rider_town || null);

  if (user.delivery_scope === 'town_delivery') {
    return {
      delivery_scope: 'town_delivery',
      town_name: resolvedTownName || null
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
      town_name: resolvedTownName || null
    };
  }

  return {
    delivery_scope: 'county_delivery',
    town_name: null
  };
};

// 给调度大屏准备位置更新 payload。
const buildDispatchLocationPayload = (user, latitude, longitude) => {
  const scope = resolveRiderScope(user);
  const isStationmaster =
    user?.rider_kind === 'stationmaster' ||
    user?.rider_level === 'captain' ||
    scope.delivery_scope === 'town_delivery';

  return {
    type: 'location_update',
    vehicleId: String(user.id),
    position: [longitude, latitude],
    speed: 0,
    direction: 0,
    status: user.rider_status === 1 ? 'idle' : 'offline',
    timestamp: Date.now(),
    rider_name: user.nickname || '',
    rider_phone: user.phone || '',
    rider_kind: user.rider_kind || 'rider',
    rider_level: user.rider_level || '',
    delivery_scope: scope.delivery_scope,
    town_name: scope.town_name || '',
    marker_type: isStationmaster ? 'stationmaster' : 'rider',
    marker_color: isStationmaster ? 'red' : 'blue'
  };
};

// 当前骑手“自己负责的订单”查询条件。
const buildRiderOwnedOrderWhere = (user) => {
  if (user?.role === MERCHANT_DELIVERY_ROLE) {
    return {
      rider_id: user.id
    };
  }

  const scope = resolveRiderScope(user);
  const where = { rider_id: user.id };
  const townNameCandidates = buildTownNameCandidates(scope.town_name);

  if (scope.delivery_scope === 'town_delivery') {
    where.order_type = 'town';
    if (townNameCandidates.length === 1) {
      where.customer_town = townNameCandidates[0];
    } else if (townNameCandidates.length > 1) {
      where.customer_town = { [Op.in]: townNameCandidates };
    }
    return where;
  }

  where.order_type = 'county';
  return where;
};

// 当前骑手“能看到的订单”查询条件。
// 这里除了本人订单，还会把乡镇待分配单、转派单等场景一起纳入。
const buildRiderVisibleOrderWhere = (user) => {
  const ownedWhere = buildRiderOwnedOrderWhere(user);
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

  const townNameCandidates = buildTownNameCandidates(scope.town_name);
  const townWhere =
    townNameCandidates.length === 1
      ? townNameCandidates[0]
      : { [Op.in]: townNameCandidates };

  return {
    [Op.or]: [
      {
        order_type: 'town',
        customer_town: townWhere,
        rider_id: user.id
      },
      {
        order_type: 'town',
        customer_town: townWhere,
        rider_id: null,
        // 乡镇骑手池只能从“商家已接单”后开始展示。
        // status=1 还只是用户已支付、等待商家接单；如果这里放出去，
        // 骑手端提醒中心轮询到新订单后就会提前语音播报，和商家接单流程冲突。
        status: { [Op.in]: [2, 3, 4] }
      },
      {
        is_transfer_order: true,
        current_responsible_user_id: user.id
      }
    ]
  };
};

// 解析乡镇站长绑定时的乡镇信息。
const resolveTownArea = async (payload = {}) => {
  const townCode = String(payload.town_code || payload.townCode || '').trim();
  const townName = String(payload.town || payload.town_name || payload.townName || '').trim();

  if (townCode) {
    return ServiceArea.findOne({
      where: {
        area_code: townCode,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  if (townName) {
    return ServiceArea.findOne({
      where: {
        area_name: townName,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  return null;
};

// ==================== 时间与统计辅助区 ====================
const pad2 = (value) => String(value).padStart(2, '0');

// 以中国时区为准，拿到当天统计窗口。
const getChinaDayWindow = (baseDate = new Date()) => {
  const offsetMs = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(baseDate.getTime() + offsetMs);
  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth();
  const day = chinaNow.getUTCDate();

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - offsetMs);
  const end = new Date(Date.UTC(year, month, day + 1, 0, 0, 0) - offsetMs);

  return {
    start,
    end,
    statDate: `${year}-${pad2(month + 1)}-${pad2(day)}`
  };
};

// 订单金额统一按两位小数输出。
const formatAmount = (value) => Number(value || 0).toFixed(2);

// 对某一批订单做字段求和，主要用于今日收入统计。
const sumOrderField = async (where, field) => {
  const row = await Order.findOne({
    where,
    attributes: [
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col(field)), 0), 'total']
    ],
    raw: true
  });

  return Number(row?.total || 0);
};

/**
 * 绑定乡镇站长
 * 普通骑手升级成乡镇站长，并绑定负责的乡镇时，会走这个接口。
 */
exports.bindStationTown = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    const townArea = await resolveTownArea(req.body);
    if (!townArea) {
      return res.status(400).json(errorResponse('缺少有效乡镇'));
    }

    const existing = await User.findOne({
      where: {
        role: 'rider',
        status: 1,
        rider_level: 'captain',
        town_code: townArea.area_code
      }
    });

    if (existing && existing.id !== user.id) {
      return res.status(400).json(errorResponse('该乡镇已绑定站长'));
    }

    await user.update({
      delivery_scope: 'town_delivery',
      rider_level: 'captain',
      town_code: townArea.area_code,
      town_name: townArea.area_name,
      rider_kind: 'stationmaster',
      rider_town: townArea.area_name
    });

    res.json(successResponse({
      delivery_scope: user.delivery_scope,
      rider_level: user.rider_level,
      town_code: user.town_code,
      town_name: user.town_name,
      rider_kind: user.rider_kind,
      rider_town: user.rider_town
    }, '绑定成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 上报骑手位置
 * 这里会做频率节流，避免前端定位轮询过快把数据库和大屏推送打爆。
 */
exports.reportLocation = async (req, res, next) => {
  try {
    const user = req.user;
    if (!['rider', MERCHANT_DELIVERY_ROLE].includes(user.role)) {
      return res.status(403).json(errorResponse('只有骑手或商家自配送员可以操作'));
    }

    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json(errorResponse('位置参数不正确'));
    }

    const freshUser = await User.findByPk(user.id, {
      attributes: ['id', 'rider_latitude', 'rider_longitude', 'rider_location_updated_at']
    });
    if (!freshUser) {
      return res.status(404).json(errorResponse('骑手不存在'));
    }

    const lastUpdatedAt = freshUser.rider_location_updated_at
      ? new Date(freshUser.rider_location_updated_at).getTime()
      : 0;
    const now = Date.now();
    const samePoint =
      Number(freshUser.rider_latitude) === latitude &&
      Number(freshUser.rider_longitude) === longitude;

    if (
      lastUpdatedAt &&
      (
        now - lastUpdatedAt < LOCATION_WRITE_MIN_INTERVAL_MS ||
        (samePoint && now - lastUpdatedAt < LOCATION_SAME_POINT_SKIP_WINDOW_MS)
      )
    ) {
      return res.json(
        successResponse(
          {
            rider_latitude: freshUser.rider_latitude,
            rider_longitude: freshUser.rider_longitude,
            rider_location_updated_at: freshUser.rider_location_updated_at,
            throttled: true
          },
          '位置上报过于频繁，已忽略本次写入'
        )
      );
    }

    await user.update({
      rider_latitude: latitude,
      rider_longitude: longitude,
      rider_location_updated_at: new Date()
    });

    // ==================== 调度大屏同步推送 ====================
    try {
      const socketService = require('../services/socketService');
      const io = socketService.getIO();
      if (io) {
        const cleanData = buildDispatchLocationPayload(user, latitude, longitude);
        io.to('dispatcher_room').emit('location_update', cleanData);
      }
    } catch (err) {
      console.error('推送骑手位置到大屏失败:', err);
    }
    // ==========================================================

    res.json(
      successResponse(
        {
          rider_latitude: user.rider_latitude,
          rider_longitude: user.rider_longitude,
          rider_location_updated_at: user.rider_location_updated_at
        },
        '位置更新成功'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 获取在线骑手位置
 * 商家端和骑手端都能看，但返回范围会按各自业务域自动收口。
 */
exports.getOnlineRiderLocations = async (req, res, next) => {
  try {
    const user = req.user;
    if (!['merchant', 'rider'].includes(user.role)) {
      return res.status(403).json(errorResponse('没有权限访问'));
    }

    const minutes = Number(req.query?.minutes || 10);
    const since = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000);
    const where = {
      role: 'rider',
      status: 1,
      rider_status: 1,
      rider_location_updated_at: { [Op.gte]: since }
    };

    if (user.role === 'merchant') {
      const merchant = await Merchant.findOne({ where: { user_id: user.id } });
      if (!merchant) {
        return res.status(404).json(errorResponse('您还没有店铺'));
      }

      if (merchant.business_scope === 'town_food') {
        where.delivery_scope = 'town_delivery';
        if (merchant.town_name) {
          where.town_name = merchant.town_name;
        }
      } else if (merchant.business_scope === 'county_food') {
        where.delivery_scope = 'county_delivery';
      }
    } else {
      const scope = resolveRiderScope(user);
      if (scope.delivery_scope === 'town_delivery') {
        where.delivery_scope = 'town_delivery';
        if (scope.town_name) {
          where.town_name = scope.town_name;
        }
      } else {
        where.delivery_scope = 'county_delivery';
      }
    }

    const riders = await User.findAll({
      where,
      attributes: [
        'id',
        'nickname',
        'phone',
        'delivery_scope',
        'town_code',
        'town_name',
        'rider_latitude',
        'rider_longitude',
        'rider_location_updated_at'
      ],
      order: [['rider_location_updated_at', 'DESC']]
    });

    res.json(successResponse(riders));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取骑手今日统计
 * 这里会返回今日总单量、完成单量、配送中单量、今日收入等数据。
 */
exports.getTodaySummary = async (req, res, next) => {
  try {
    const user = req.user;
    if (!['rider', MERCHANT_DELIVERY_ROLE].includes(user.role)) {
      return res.status(403).json(errorResponse('只有配送账号可以查看'));
    }

    const { start, end, statDate } = getChinaDayWindow();
    const ownedWhere = buildRiderOwnedOrderWhere(user);

    const todayTotalOrdersWhere = {
      ...ownedWhere,
      created_at: {
        [Op.gte]: start,
        [Op.lt]: end
      }
    };

    const todayCompletedWhere = {
      ...ownedWhere,
      status: 6,
      delivered_at: {
        [Op.gte]: start,
        [Op.lt]: end
      }
    };

    const deliveringWhere = {
      ...ownedWhere,
      status: 5
    };

    const settledTodayWhere = {
      ...ownedWhere,
      status: 6,
      settled_at: {
        [Op.gte]: start,
        [Op.lt]: end
      }
    };

    const unsettledCompletedWhere = {
      ...todayCompletedWhere,
      [Op.or]: [
        { settled_at: null },
        { settled_at: { [Op.gte]: end } }
      ]
    };

    const [
      todayTotalOrders,
      todayCompletedOrders,
      currentDeliveringOrders,
      todayRiderIncome,
      todaySettledIncome,
      todayUnsettledIncome
    ] = await Promise.all([
      Order.count({ where: todayTotalOrdersWhere }),
      Order.count({ where: todayCompletedWhere }),
      Order.count({ where: deliveringWhere }),
      sumOrderField(todayCompletedWhere, 'rider_fee'),
      sumOrderField(settledTodayWhere, 'rider_fee'),
      sumOrderField(unsettledCompletedWhere, 'rider_fee')
    ]);

    const notes = [
      'today_total_orders 按 created_at 落在统计日内且当前归属该骑手的订单数统计。',
      'today_completed_orders 与 today_rider_income 按 delivered_at 口径统计。',
      'today_settled_income 按 settled_at 口径统计；当前系统未落独立骑手收入流水账。',
      '当前接口不包含系统内尚未建模的骑手扣罚、补差等调整项。'
    ];

    res.json(successResponse({
      stat_date: statDate,
      timezone: 'Asia/Shanghai',
      time_basis: {
        total_orders: 'created_at',
        completed_orders: 'delivered_at',
        delivering_orders: 'current_status',
        rider_income: 'completed_orders.rider_fee',
        settled_income: 'settled_at',
        unsettled_income: 'completed_orders_without_settled_at'
      },
      today_total_orders: todayTotalOrders,
      today_completed_orders: todayCompletedOrders,
      today_delivering_orders: currentDeliveringOrders,
      current_delivering_orders: currentDeliveringOrders,
      today_rider_income: formatAmount(todayRiderIncome),
      today_completed_income_estimate: formatAmount(todayRiderIncome),
      today_settled_income: formatAmount(todaySettledIncome),
      today_unsettled_income: formatAmount(todayUnsettledIncome),
      today_unsettled_income_estimate: formatAmount(todayUnsettledIncome),
      has_settlement_ledger: false,
      notes
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我可见的订单
 * 这里只给普通骑手使用，返回当前骑手能看见和能操作的订单集合。
 */
exports.getMyAssignedOrders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const { status } = req.query;
    // 注意这里调用的是当前文件里的本地查询函数，不是策略文件原函数。
    // 本地函数本来就吃裸 user，如果这里再包一层 `{ user }`，
    // SQL 条件里的 rider_id 会被拼成 undefined，订单列表会直接报错。
    const where = buildRiderVisibleOrderWhere(user);
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone', 'longitude', 'latitude'] }
      ],
      order: [['id', 'DESC']]
    });

    const normalized = orders.map((o) => {
      const plain = o.get({ plain: true });
      return {
        ...plain,
        merchantLng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchantLat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        merchant_lng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchant_lat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        customer_lng: Number(plain.customer_lng || plain.delivery_longitude || 0) || null,
        customer_lat: Number(plain.customer_lat || plain.delivery_latitude || 0) || null,
        longitude: Number(plain.customer_lng || plain.delivery_longitude || 0) || null,
        latitude: Number(plain.customer_lat || plain.delivery_latitude || 0) || null,
        is_transfer_order: Boolean(plain.is_transfer_order),
        transfer_tag: plain.is_transfer_order ? '转派单' : '',
        transfer_status: plain.transfer_status || '',
        transfer_round: Number(plain.transfer_round || 0),
        current_responsible_user_id: plain.current_responsible_user_id || plain.rider_id || null,
        current_responsible_role: plain.current_responsible_role || '',
        transfer_from_user_id: plain.transfer_from_user_id || null,
        transfer_to_user_id: plain.transfer_to_user_id || null,
        transfer_to_town: plain.transfer_to_town_name || '',
        transfer_last_action_at: plain.transfer_last_action_at || null,
        transfer_last_action_type: plain.transfer_last_action_type || '',
        can_transfer_revoke: Boolean(plain.is_transfer_order) && !Boolean(plain.transfer_revoke_used)
      };
    });

    res.json(successResponse(normalized));
  } catch (error) {
    next(error);
  }
};
