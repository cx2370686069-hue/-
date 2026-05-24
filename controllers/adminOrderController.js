// 这个文件是“后台订单管理控制器”。
// 后台订单列表、订单详情、异常单统计、超时未接单统计，主要都从这里查。
const { Op } = require('sequelize');
const { Order, Merchant, User, Refund, OrderLog } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

// 这里统一维护订单状态文案，避免后台列表和详情各自写一套。
const STATUS_LABEL_MAP = {
  0: '待付款',
  1: '待接单',
  2: '备餐中',
  3: '待配送',
  4: '骑手已接单',
  5: '配送中',
  6: '已完成',
  7: '已取消'
};

// 后台会把订单按业务线做一层归类展示。
// 这里统一定义县城外卖、乡镇外卖、跑腿三种业务元信息。
const BUSINESS_META_MAP = {
  county_takeout: {
    business_type: 'county_takeout',
    business_label: '县城外卖',
    business_badge: 'county'
  },
  town_takeout: {
    business_type: 'town_takeout',
    business_label: '乡镇外卖',
    business_badge: 'town'
  },
  errand: {
    business_type: 'errand',
    business_label: '跑腿订单',
    business_badge: 'errand'
  }
};

// 统一解析后台分页参数。
const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

// 后台筛选里的业务类型，统一在这里做兼容。
const normalizeBusinessType = (value) => {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (['county', 'county_takeout'].includes(normalized)) return 'county_takeout';
  if (['town', 'town_takeout'].includes(normalized)) return 'town_takeout';
  if (['errand', 'paotui'].includes(normalized)) return 'errand';
  return 'all';
};

// 异常单类型目前先支持“超时未接单”这一类，后面扩展也从这里加。
const normalizeExceptionType = (value) => {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (['timeout_unaccepted', 'merchant_timeout_unaccepted', 'overtime_unaccepted'].includes(normalized)) {
    return 'timeout_unaccepted';
  }
  return 'all';
};

// 超时分钟数统一走这里，顺手限制范围，避免前端传过大值。
const normalizeTimeoutMinutes = (value, defaultValue = 1) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, 180);
};

// 把日期字符串尽量转成可用的时间对象。
// 如果前端只传 yyyy-mm-dd，这里会补成当天开始或当天结束时间。
const parseDateMaybe = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }
  return date;
};

// 根据订单本身字段，推导它属于县城外卖、乡镇外卖还是跑腿单。
const buildBusinessMeta = (order) => {
  if (order?.type === 'errand') return BUSINESS_META_MAP.errand;
  if (order?.order_type === 'town') return BUSINESS_META_MAP.town_takeout;
  return BUSINESS_META_MAP.county_takeout;
};

// 判断“超时未接单”时，优先用 paid_at，没有就退回到 created_at。
const getTimeoutReferenceTime = (order) => order?.paid_at || order?.created_at || null;

// 计算订单已经等待了多少分钟，主要给后台异常单识别使用。
const getWaitMinutes = (order) => {
  const baseTime = getTimeoutReferenceTime(order);
  if (!baseTime) return null;
  const diff = Date.now() - new Date(baseTime).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
};

// 判断一笔订单是不是“超时未接单”。
// 当前规则是：普通外卖单、状态仍为待接单、并且等待时间达到阈值。
const isTimeoutUnacceptedOrder = (order, timeoutMinutes = 1) => {
  if (!order || order.type === 'errand' || Number(order.status) !== 1) {
    return false;
  }
  return (getWaitMinutes(order) || 0) >= timeoutMinutes;
};

// 构造“超时未接单”的数据库查询条件。
const buildTimeoutUnacceptedWhere = (timeoutMinutes = 1) => {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  return {
    type: 'takeout',
    status: 1,
    [Op.or]: [
      {
        paid_at: {
          [Op.lte]: cutoff
        }
      },
      {
        [Op.and]: [
          { paid_at: null },
          {
            created_at: {
              [Op.lte]: cutoff
            }
          }
        ]
      }
    ]
  };
};

// 后台订单筛选条件统一在这里拼。
// 这样列表接口和其他统计接口就能共用同一套筛选口径。
const buildOrderWhere = (query = {}) => {
  const where = {};
  const businessType = normalizeBusinessType(query.business_type);
  const exceptionType = normalizeExceptionType(query.exception_type);
  const timeoutMinutes = normalizeTimeoutMinutes(query.timeout_minutes, 1);

  if (businessType === 'county_takeout') {
    where.type = 'takeout';
    where.order_type = 'county';
  } else if (businessType === 'town_takeout') {
    where.type = 'takeout';
    where.order_type = 'town';
  } else if (businessType === 'errand') {
    where.type = 'errand';
  }

  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const parsedStatus = parseInt(query.status, 10);
    if (!Number.isNaN(parsedStatus)) {
      where.status = parsedStatus;
    }
  }

  const keyword = String(query.keyword || '').trim();
  if (keyword) {
    where[Op.or] = [
      { order_no: { [Op.like]: `%${keyword}%` } },
      { contact_name: { [Op.like]: `%${keyword}%` } },
      { contact_phone: { [Op.like]: `%${keyword}%` } },
      { address: { [Op.like]: `%${keyword}%` } },
      { customer_town: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const townName = String(query.town_name || '').trim();
  if (townName) {
    where.customer_town = {
      [Op.like]: `%${townName}%`
    };
  }

  const startTime = parseDateMaybe(query.start_time || query.start_date, false);
  const endTime = parseDateMaybe(query.end_time || query.end_date, true);
  if (startTime || endTime) {
    where.created_at = {};
    if (startTime) where.created_at[Op.gte] = startTime;
    if (endTime) where.created_at[Op.lte] = endTime;
  }

  if (exceptionType === 'timeout_unaccepted') {
    Object.assign(where, buildTimeoutUnacceptedWhere(timeoutMinutes));
  }

  return {
    where,
    businessType,
    exceptionType,
    timeoutMinutes
  };
};

// 商家信息联表查询统一走这里，方便后台按商家名或商家手机号筛单。
const buildMerchantInclude = (query = {}) => {
  const merchantName = String(query.merchant_name || '').trim();
  const merchantPhone = String(query.merchant_phone || '').trim();
  const merchantWhere = {};

  if (merchantName) {
    merchantWhere.name = { [Op.like]: `%${merchantName}%` };
  }

  if (merchantPhone) {
    merchantWhere.phone = { [Op.like]: `%${merchantPhone}%` };
  }

  return {
    model: Merchant,
    as: 'merchant',
    attributes: ['id', 'user_id', 'name', 'phone', 'address', 'business_scope', 'town_name'],
    required: Object.keys(merchantWhere).length > 0,
    where: Object.keys(merchantWhere).length > 0 ? merchantWhere : undefined
  };
};

// 买家信息联表配置。
const buildBuyerInclude = () => ({
  model: User,
  as: 'user',
  attributes: ['id', 'nickname', 'phone']
});

// 骑手信息联表配置。
const buildRiderInclude = () => ({
  model: User,
  as: 'rider',
  attributes: ['id', 'nickname', 'phone', 'rider_status', 'town_name']
});

// 金额统一转成两位小数文本，避免后台显示时格式不一致。
const formatMoney = (value) => {
  const num = Number(value || 0);
  return num.toFixed(2);
};

// 根据订单状态，给后台列表补“异常标签”。
const buildExceptionTags = (order, timeoutMinutes) => {
  const tags = [];
  if (isTimeoutUnacceptedOrder(order, timeoutMinutes)) {
    tags.push({
      code: 'timeout_unaccepted',
      label: '超时未接单'
    });
  }
  if (order?.dispatch_center_status === 'failed') {
    tags.push({
      code: 'dispatch_failed',
      label: '调度失败'
    });
  }
  if (Number(order?.status) === 7) {
    tags.push({
      code: 'canceled',
      label: '已取消'
    });
  }
  return tags;
};

// 这里把订单整理成后台列表摘要结构。
// 列表页优先看概览，所以这里只放核心信息，不塞太重的详情字段。
const formatOrderSummary = (order, timeoutMinutes = 1) => {
  const meta = buildBusinessMeta(order);
  const waitMinutes = getWaitMinutes(order);
  const exceptionTags = buildExceptionTags(order, timeoutMinutes);

  return {
    id: order.id,
    order_no: order.order_no,
    business_type: meta.business_type,
    business_label: meta.business_label,
    business_badge: meta.business_badge,
    order_type: order.order_type,
    status: order.status,
    status_label: STATUS_LABEL_MAP[order.status] || '未知状态',
    dispatch_center_status: order.dispatch_center_status || '',
    merchant: order.merchant
      ? {
          id: order.merchant.id,
          name: order.merchant.name,
          phone: order.merchant.phone,
          address: order.merchant.address,
          business_scope: order.merchant.business_scope,
          town_name: order.merchant.town_name
        }
      : null,
    buyer: order.user
      ? {
          id: order.user.id,
          nickname: order.user.nickname,
          phone: order.user.phone
        }
      : null,
    rider: order.rider
      ? {
          id: order.rider.id,
          nickname: order.rider.nickname,
          phone: order.rider.phone,
          rider_status: order.rider.rider_status,
          town_name: order.rider.town_name
        }
      : null,
    customer_town: order.customer_town || '',
    contact_name: order.contact_name || '',
    contact_phone: order.contact_phone || '',
    address: order.address || '',
    errand_type: order.errand_type || '',
    total_amount: formatMoney(order.total_amount),
    pay_amount: formatMoney(order.pay_amount),
    rider_fee: formatMoney(order.rider_fee),
    created_at: order.created_at,
    paid_at: order.paid_at,
    accepted_at: order.accepted_at,
    delivered_at: order.delivered_at,
    settled_at: order.settled_at,
    wait_minutes: waitMinutes,
    timeout_minutes: isTimeoutUnacceptedOrder(order, timeoutMinutes) ? waitMinutes : null,
    exception_tags: exceptionTags,
    primary_exception_code: exceptionTags[0]?.code || '',
    primary_exception_label: exceptionTags[0]?.label || ''
  };
};

// 这里把订单整理成后台详情结构。
// 详情比摘要多带退款记录、订单日志、支付和收益字段。
const formatOrderDetail = (order, timeoutMinutes = 1) => {
  const summary = formatOrderSummary(order, timeoutMinutes);
  return {
    ...summary,
    remark: order.remark || '',
    cancel_reason: order.cancel_reason || '',
    delivery_address: order.delivery_address || null,
    items_json: order.items_json || [],
    products_info: order.products_info || [],
    dispatch_center_order_id: order.dispatch_center_order_id || '',
    dispatch_sent_at: order.dispatch_sent_at,
    merge_group_id: order.merge_group_id,
    is_group_main: Boolean(order.is_group_main),
    payment_channel: order.payment_channel || '',
    delivery_type: order.delivery_type,
    commission_amount: formatMoney(order.commission_amount),
    rider_incentive_amount: formatMoney(order.rider_incentive_amount),
    platform_income_amount: formatMoney(order.platform_income_amount),
    merchant_income_amount: formatMoney(order.merchant_income_amount),
    refunds: Array.isArray(order.refunds)
      ? order.refunds.map((refund) => ({
          id: refund.id,
          refund_no: refund.refund_no,
          amount: formatMoney(refund.amount),
          status: refund.status,
          reason_type: refund.reason_type,
          description: refund.description,
          reject_reason: refund.reject_reason,
          merchant_audit_at: refund.merchant_audit_at,
          success_at: refund.success_at
        }))
      : [],
    logs: Array.isArray(order.logs)
      ? order.logs.map((log) => ({
          id: log.id,
          order_id: log.order_id,
          operator_id: log.operator_id,
          operator_type: log.operator_type,
          action: log.action,
          from_status: log.from_status,
          to_status: log.to_status,
          remark: log.remark,
          created_at: log.createdAt
        }))
      : []
  };
};

// 对外暴露一个“统计超时未接单数量”的复用函数，给后台概览等地方使用。
const countTimeoutUnacceptedOrders = async (timeoutMinutes = 1) => Order.count({
  where: buildTimeoutUnacceptedWhere(timeoutMinutes)
});

/**
 * 后台订单列表
 * 支持按业务类型、状态、时间、商家、关键词等多种条件筛选。
 */
const getOrderList = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { where, businessType, exceptionType, timeoutMinutes } = buildOrderWhere(req.query);

    const result = await Order.findAndCountAll({
      where,
      include: [
        buildMerchantInclude(req.query),
        buildBuyerInclude(),
        buildRiderInclude()
      ],
      order: [['id', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    res.json(successResponse({
      list: result.rows.map((order) => formatOrderSummary(order, timeoutMinutes)),
      filters: {
        business_type: businessType,
        status: req.query.status ?? 'all',
        exception_type: exceptionType,
        timeout_minutes: timeoutMinutes
      },
      pagination: {
        total: result.count,
        page,
        limit,
        total_pages: Math.ceil(result.count / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 后台订单详情
 * 这里会把退款记录和订单日志一起查出来，方便后台完整排查一笔订单。
 */
const getOrderDetail = async (req, res, next) => {
  try {
    const timeoutMinutes = normalizeTimeoutMinutes(req.query.timeout_minutes, 1);
    const order = await Order.findByPk(req.params.id, {
      include: [
        buildMerchantInclude(req.query),
        buildBuyerInclude(),
        buildRiderInclude(),
        {
          model: Refund,
          as: 'refunds',
          attributes: [
            'id',
            'refund_no',
            'amount',
            'status',
            'reason_type',
            'description',
            'reject_reason',
            'merchant_audit_at',
            'success_at'
          ],
          separate: true,
          order: [['id', 'DESC']]
        },
        {
          model: OrderLog,
          as: 'logs',
          attributes: [
            'id',
            'order_id',
            'operator_id',
            'operator_type',
            'action',
            'from_status',
            'to_status',
            'remark',
            'createdAt'
          ],
          separate: true,
          order: [['id', 'DESC']]
        }
      ]
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在', 404));
    }

    res.json(successResponse(formatOrderDetail(order, timeoutMinutes)));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrderList,
  getOrderDetail,
  countTimeoutUnacceptedOrders,
  buildTimeoutUnacceptedWhere
};
