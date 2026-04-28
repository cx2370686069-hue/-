const { Merchant, Order, Product, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const moment = require('moment');

/**
 * 获取商家工作台数据（dashboard）
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const user = req.user;
    
    // 获取商家信息
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const today = moment().startOf('day');
    const tomorrow = moment().add(1, 'days').startOf('day');

    // 今日订单数
    const todayOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: {
          [Op.gte]: today.toDate(),
          [Op.lt]: tomorrow.toDate()
        }
      }
    });

    // 今日营收
    const todayRevenueResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: { [Op.in]: [5, 6] }, // 已完成
        created_at: {
          [Op.gte]: today.toDate(),
          [Op.lt]: tomorrow.toDate()
        }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('pay_amount')), 'total']]
    });
    const todayRevenue = todayRevenueResult?.dataValues?.total || 0;

    // 待处理订单数（待接单 + 制作中）
    const pendingOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        status: { [Op.in]: [1, 2, 3] } // 待接单、已接单、制作中
      }
    });

    // 本月订单数
    const monthStart = moment().startOf('month');
    const monthOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: {
          [Op.gte]: monthStart.toDate()
        }
      }
    });

    // 店铺状态
    const isOpen = merchant.status === 1;

    res.json(successResponse({
      shopName: merchant.name,
      todayOrders,
      todayRevenue: parseFloat(todayRevenue).toFixed(2),
      pendingOrders,
      monthOrders,
      isOpen
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取统计数据（近 7 天订单趋势）
 */
exports.getStats = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const days = 7;
    const stats = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const start = date.startOf('day');
      const end = date.endOf('day');

      const count = await Order.count({
        where: {
          merchant_id: merchant.id,
          created_at: {
            [Op.gte]: start.toDate(),
            [Op.lte]: end.toDate()
          }
        }
      });

      const revenue = await Order.findOne({
        where: {
          merchant_id: merchant.id,
          status: { [Op.in]: [5, 6] },
          created_at: {
            [Op.gte]: start.toDate(),
            [Op.lte]: end.toDate()
          }
        },
        attributes: [[sequelize.fn('SUM', sequelize.col('pay_amount')), 'total']]
      });

      stats.push({
        date: date.format('YYYY-MM-DD'),
        day: date.format('dddd'),
        orders: count,
        revenue: parseFloat(revenue?.dataValues?.total || 0).toFixed(2)
      });
    }

    res.json(successResponse(stats));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取热销商品
 */
exports.getHotProducts = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 简化版本：直接返回商品销量排序
    const products = await Product.findAll({
      where: { merchant_id: merchant.id },
      order: [['sales', 'DESC']],
      limit: 10
    });

    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
};
