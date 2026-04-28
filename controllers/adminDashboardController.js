const { Op } = require('sequelize');
const { Merchant, Order, User } = require('../models');
const { successResponse } = require('../utils/helpers');

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

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
          role: 'rider',
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
          role: 'rider',
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

exports.getPendingCounts = async (req, res, next) => {
  try {
    const [pendingMerchants, pendingRiders, abnormalOrders, offlineRiders] = await Promise.all([
      Merchant.count({
        where: {
          audit_status: 0
        }
      }),
      User.count({
        where: {
          role: 'rider',
          rider_audit_status: 0
        }
      }),
      countAbnormalOrders(),
      User.count({
        where: {
          role: 'rider',
          rider_audit_status: 1,
          [Op.or]: [
            { status: 0 },
            { rider_status: 0 }
          ]
        }
      })
    ]);

    res.json(successResponse({
      pending_merchants: pendingMerchants,
      pending_riders: pendingRiders,
      abnormal_orders: abnormalOrders,
      offline_riders: offlineRiders
    }));
  } catch (error) {
    next(error);
  }
};
