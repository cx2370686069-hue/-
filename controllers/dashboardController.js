// 这个文件是“商家工作台控制器”。
// 商家后台首页那几块总览数据、近 7 天趋势、热销商品，主要都从这里查。
const { Merchant, Order, Product, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const moment = require('moment');

// 工作台营收统一按“已完成订单”统计。
// 也就是只有 status=6 的订单，才会真正算进商家营收。
const buildCompletedRevenueWhere = ({ merchantId, start, end }) => ({
  merchant_id: merchantId,
  status: 6,
  delivered_at: {
    [Op.gte]: start,
    [Op.lt]: end
  }
});

/**
 * 获取商家工作台首页概览
 * 这里返回首页最上面那几个核心数字，比如今日订单、今日营收、待处理订单、本月订单。
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const user = req.user;
    
    // 先确认当前登录用户已经开通了商家店铺。
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const today = moment().startOf('day');
    const tomorrow = moment().add(1, 'days').startOf('day');

    // 这里保留“今天创建的订单数”，给工作台或后续统计扩展用。
    // 但它不等于“商家当前能处理的新订单”，因为里面会混入待支付、已取消等状态。
    const todayOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: {
          [Op.gte]: today.toDate(),
          [Op.lt]: tomorrow.toDate()
        }
      }
    });

    // 首页右上角“新订单”必须和订单页的“新订单”口径一致。
    // 订单页现在只把 status=1 当成待接单新订单，所以这里也只统计 status=1，
    // 避免出现“首页数字一直涨，但订单页没有单”的误导。
    const todayNewOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        status: 1
      }
    });

    // 今日营收只按已完成订单统计，配送中订单还不能计入营收。
    const todayRevenueResult = await Order.findOne({
      where: buildCompletedRevenueWhere({
        merchantId: merchant.id,
        start: today.toDate(),
        end: tomorrow.toDate()
      }),
      attributes: [[sequelize.fn('SUM', sequelize.col('pay_amount')), 'total']]
    });
    const todayRevenue = todayRevenueResult?.dataValues?.total || 0;

    // 这里把待接单、备餐中、待配送都算作“待处理订单”。
    const pendingOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        status: { [Op.in]: [1, 2, 3] } // 待接单、已接单、制作中
      }
    });

    // 统计本月累计订单数。
    const monthStart = moment().startOf('month');
    const monthOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: {
          [Op.gte]: monthStart.toDate()
        }
      }
    });

    // 当前店铺是否营业。
    const isOpen = merchant.status === 1;

    res.json(successResponse({
      shopName: merchant.name,
      todayOrders,
      todayNewOrders,
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
 * 获取近 7 天订单趋势
 * 这里按天循环统计订单数和营收，用于商家工作台折线图。
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
        where: buildCompletedRevenueWhere({
          merchantId: merchant.id,
          start: start.toDate(),
          end: date.clone().add(1, 'day').startOf('day').toDate()
        }),
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
 * 当前是简化实现：直接按商品销量倒序取前 10 名。
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
