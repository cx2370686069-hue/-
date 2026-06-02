// 这个文件是“后台订单管理控制器”。
// 后台订单列表、订单详情、异常单统计、超时未接单统计，主要都从这里查。
const { Op } = require('sequelize');
const { Order, Merchant, User, Refund, OrderLog, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const socketService = require('../services/socketService');

const CANCEL_REFUND_APPLY_SOURCE = 'cancel';
const REFUND_STATUS_LABEL_MAP = {
  0: '待后台审核',
  1: '审核通过，退款处理中',
  2: '退款成功',
  3: '后台已驳回',
  4: '用户已撤销申请'
};

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
  const latestCancelRefund = Array.isArray(order?.refunds)
    ? order.refunds.find((item) => item?.apply_source === CANCEL_REFUND_APPLY_SOURCE) || null
    : order?.latest_cancel_refund || null;
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
  if (
    latestCancelRefund &&
    latestCancelRefund.apply_source === CANCEL_REFUND_APPLY_SOURCE &&
    Number(latestCancelRefund.status) === 0
  ) {
    tags.unshift({
      code: 'cancel_audit_pending',
      label: '待审核取消'
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
  const latestCancelRefund = Array.isArray(order?.refunds)
    ? order.refunds.find((item) => item?.apply_source === CANCEL_REFUND_APPLY_SOURCE) || null
    : order?.latest_cancel_refund || null;

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
    latest_cancel_refund: latestCancelRefund
      ? {
          id: latestCancelRefund.id,
          refund_no: latestCancelRefund.refund_no,
          status: Number(latestCancelRefund.status),
          status_label: REFUND_STATUS_LABEL_MAP[Number(latestCancelRefund.status)] || '未知状态',
          amount: formatMoney(latestCancelRefund.amount),
          reason_type: latestCancelRefund.reason_type || '',
          description: latestCancelRefund.description || '',
          reject_reason: latestCancelRefund.reject_reason || '',
          apply_source: latestCancelRefund.apply_source || '',
          audit_note: latestCancelRefund.audit_note || '',
          cancel_fee_amount: formatMoney(latestCancelRefund.cancel_fee_amount),
          is_full_refund: Boolean(latestCancelRefund.is_full_refund)
        }
      : null,
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
          status_label: REFUND_STATUS_LABEL_MAP[Number(refund.status)] || '未知状态',
          reason_type: refund.reason_type,
          description: refund.description,
          apply_source: refund.apply_source || '',
          responsibility_type: refund.responsibility_type || '',
          cancel_fee_amount: formatMoney(refund.cancel_fee_amount),
          is_full_refund: Boolean(refund.is_full_refund),
          reject_reason: refund.reject_reason,
          audit_note: refund.audit_note || '',
          audit_role: refund.audit_role || '',
          audit_user_id: refund.audit_user_id || null,
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

    const orderIds = result.rows.map((order) => Number(order.id)).filter((id) => Number.isInteger(id) && id > 0);
    const latestCancelRefundMap = new Map();
    if (orderIds.length) {
      const refunds = await Refund.findAll({
        where: {
          order_id: { [Op.in]: orderIds },
          apply_source: CANCEL_REFUND_APPLY_SOURCE
        },
        order: [['id', 'DESC']]
      });
      for (const refund of refunds) {
        const orderId = Number(refund.order_id);
        if (!latestCancelRefundMap.has(orderId)) {
          latestCancelRefundMap.set(orderId, refund.get({ plain: true }));
        }
      }
    }

    res.json(successResponse({
      list: result.rows.map((order) => {
        order.latest_cancel_refund = latestCancelRefundMap.get(Number(order.id)) || null;
        return formatOrderSummary(order, timeoutMinutes);
      }),
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
            'apply_source',
            'responsibility_type',
            'cancel_fee_amount',
            'is_full_refund',
            'reject_reason',
            'audit_note',
            'audit_role',
            'audit_user_id',
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

/**
 * 后台审核取消申请
 * 第一期开启“后台人工审核”，不再让前端各端自己猜该退多少、该不该放行。
 */
const auditCancelOrder = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const action = String(req.body?.action || '').trim();
    const auditNote = String(req.body?.audit_note || req.body?.auditNote || '').trim();
    const rejectReason = String(req.body?.reject_reason || req.body?.rejectReason || '').trim();
    const responsibilityType = String(req.body?.responsibility_type || req.body?.responsibilityType || '').trim() || 'platform';
    const requestedAmount = req.body?.refund_amount ?? req.body?.refundAmount;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效的订单ID'));
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json(errorResponse('审核动作只能是 approve 或 reject'));
    }
    if (action === 'reject' && !rejectReason) {
      return res.status(400).json(errorResponse('驳回时必须填写驳回原因'));
    }

    let payload = null;
    let notifyUserId = null;
    let notifyMerchantId = null;
    let notifyOrder = null;
    await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!order) {
        const err = new Error('订单不存在'); err.statusCode = 404; throw err;
      }

      const refund = await Refund.findOne({
        where: {
          order_id: orderId,
          status: 0,
          apply_source: CANCEL_REFUND_APPLY_SOURCE
        },
        order: [['id', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!refund) {
        const err = new Error('当前订单没有待审核的取消申请'); err.statusCode = 400; throw err;
      }

      notifyUserId = order.user_id || null;
      notifyOrder = {
        id: order.id,
        order_no: order.order_no
      };
      if (order.merchant_id) {
        const merchant = await Merchant.findByPk(order.merchant_id, {
          attributes: ['user_id'],
          transaction: t
        });
        notifyMerchantId = merchant?.user_id || null;
      }

      const payAmount = Number(order.pay_amount || 0);
      const finalRefundAmount = action === 'approve'
        ? Math.min(Math.max(Number(requestedAmount ?? payAmount), 0), payAmount)
        : Number(refund.amount || 0);
      const cancelFeeAmount = Math.max(payAmount - finalRefundAmount, 0);

      if (action === 'approve') {
        await refund.update({
          amount: finalRefundAmount,
          status: 2,
          responsibility_type: responsibilityType,
          cancel_fee_amount: cancelFeeAmount,
          is_full_refund: cancelFeeAmount === 0,
          reject_reason: '',
          audit_note: auditNote || '',
          audit_role: 'admin',
          audit_user_id: req.user?.id || null,
          merchant_audit_at: new Date(),
          success_at: new Date()
        }, { transaction: t });

        await order.update({
          status: 7,
          cancel_reason: refund.description || order.cancel_reason || '后台审核通过取消申请'
        }, { transaction: t });

        await OrderLog.create({
          order_id: order.id,
          operator_id: req.user?.id || null,
          operator_type: 'system',
          action: '后台通过取消申请',
          from_status: order.status,
          to_status: 7,
          remark: auditNote || `后台已通过取消申请，退款 ${finalRefundAmount.toFixed(2)} 元`
        }, { transaction: t });

        payload = {
          action: 'approve',
          refund_id: refund.id,
          refund_amount: formatMoney(finalRefundAmount),
          cancel_fee_amount: formatMoney(cancelFeeAmount)
        };
      } else {
        await refund.update({
          status: 3,
          reject_reason: rejectReason,
          audit_note: auditNote || '',
          audit_role: 'admin',
          audit_user_id: req.user?.id || null,
          merchant_audit_at: new Date()
        }, { transaction: t });

        await OrderLog.create({
          order_id: order.id,
          operator_id: req.user?.id || null,
          operator_type: 'system',
          action: '后台驳回取消申请',
          from_status: order.status,
          to_status: order.status,
          remark: rejectReason
        }, { transaction: t });

        payload = {
          action: 'reject',
          refund_id: refund.id,
          reject_reason: rejectReason
        };
      }
    });

    if (notifyUserId && notifyOrder) {
      socketService.notifyUserOrderUpdate(
        notifyUserId,
        notifyOrder,
        action === 'approve' ? '后台已通过取消申请，订单已取消' : '后台已驳回取消申请'
      );
    }
    if (notifyMerchantId && notifyOrder) {
      socketService.notifyMerchantReminder(notifyMerchantId, notifyOrder, {
        eventType: action === 'approve' ? 'merchant_order_cancelled' : 'merchant_order_cancel_rejected',
        title: action === 'approve' ? '取消申请已通过' : '取消申请已驳回',
        message: action === 'approve'
          ? `订单 ${notifyOrder.order_no} 的取消申请已由后台通过`
          : `订单 ${notifyOrder.order_no} 的取消申请已由后台驳回`,
        speechText: action === 'approve' ? '有订单取消申请已通过' : '有订单取消申请已驳回',
        soundType: action === 'approve' ? 'merchant_order_cancelled' : 'merchant_order_new',
        priority: 'medium',
        jumpPath: '/pages/order/list',
        dedupeKey: `${action === 'approve' ? 'merchant_order_cancelled' : 'merchant_order_cancel_rejected'}:${notifyOrder.id}`
      });
    }
    await socketService.broadcastDispatcherOrdersUpdate();

    res.json(successResponse(payload, action === 'approve' ? '已通过取消申请' : '已驳回取消申请'));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
    }
    next(error);
  }
};

module.exports = {
  getOrderList,
  getOrderDetail,
  countTimeoutUnacceptedOrders,
  buildTimeoutUnacceptedWhere,
  auditCancelOrder
};
