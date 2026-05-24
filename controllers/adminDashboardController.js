// 这个文件是“后台首页概览控制器”。
// 主要负责后台首页那些总览数字和待处理角标，不直接管订单详情、审核详情。
const { Op } = require('sequelize');
const { Merchant, Order, User } = require('../models');
const { successResponse } = require('../utils/helpers');
const { countTimeoutUnacceptedOrders } = require('./adminOrderController');
const RIDER_AUDIT_ROLE_GROUP = ['rider', 'merchant_delivery'];

// 这里统一生成“今天”的时间范围。
// 后面凡是统计今日数据，都复用这个时间段，避免每个接口自己写一遍。
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

// 这里统计后台关注的“异常订单”数量。
// 当前口径是：已取消、调度失败、或者带有取消原因的订单，都算异常单。
const countAbnormalOrders = async () => Order.count({
  where: {
    [Op.or]: [
      { status: 7 },
      { dispatch_center_status: 'failed' },
      {
        cancel_reason: {
          [Op.not]: null
        }
      }
    ]
  }
});

/**
 * 后台首页概览
 * 这里返回的是首页最上面那几个核心数字，比如今日订单、活跃商家、在线骑手、待审核总数。
 */
exports.getOverview = async (req, res, next) => {
  try {
    const { start, end } = getTodayRange();

    const [todayOrders, activeMerchants, onlineRiders, pendingMerchants, pendingRiders] = await Promise.all([
      Order.count({
        where: {
          created_at: {
            [Op.gte]: start,
            [Op.lt]: end
          }
        }
      }),
      Merchant.count({
        where: {
          status: 1,
          audit_status: 1
        }
      }),
      User.count({
        where: {
          role: {
            [Op.in]: RIDER_AUDIT_ROLE_GROUP
          },
          status: 1,
          rider_audit_status: 1,
          rider_status: 1
        }
      }),
      Merchant.count({
        where: {
          audit_status: 0
        }
      }),
      User.count({
        where: {
          role: {
            [Op.in]: RIDER_AUDIT_ROLE_GROUP
          },
          rider_audit_status: 0
        }
      })
    ]);

    res.json(successResponse({
      today_orders: todayOrders,
      active_merchants: activeMerchants,
      online_riders: onlineRiders,
      pending_review_items: pendingMerchants + pendingRiders
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 后台待处理角标统计
 * 这里返回的是待审核、异常订单、离线骑手、超时未接单这些更偏“待办提醒”的数字。
 */
exports.getPendingCounts = async (req, res, next) => {
  try {
    const timeoutMinutes = Math.min(Math.max(parseInt(req.query.timeout_minutes, 10) || 1, 1), 180);

    const [pendingMerchants, pendingRiders, abnormalOrders, offlineRiders, timeoutUnacceptedOrders] = await Promise.all([
      Merchant.count({
        where: {
          audit_status: 0
        }
      }),
      User.count({
        where: {
          role: {
            [Op.in]: RIDER_AUDIT_ROLE_GROUP
          },
          rider_audit_status: 0
        }
      }),
      countAbnormalOrders(),
      User.count({
        where: {
          role: {
            [Op.in]: RIDER_AUDIT_ROLE_GROUP
          },
          rider_audit_status: 1,
          [Op.or]: [
            { status: 0 },
            { rider_status: 0 }
          ]
        }
      }),
      countTimeoutUnacceptedOrders(timeoutMinutes)
    ]);

    res.json(successResponse({
      pending_merchants: pendingMerchants,
      pending_riders: pendingRiders,
      abnormal_orders: abnormalOrders,
      offline_riders: offlineRiders,
      timeout_unaccepted_orders: timeoutUnacceptedOrders,
      timeout_unaccepted_threshold_minutes: timeoutMinutes
    }));
  } catch (error) {
    next(error);
  }
};
