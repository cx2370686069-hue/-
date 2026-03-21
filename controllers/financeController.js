const { Merchant, Order, User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const moment = require('moment');

/**
 * 获取财务统计数据
 */
exports.getFinanceStats = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const today = moment().startOf('day');
    const weekStart = moment().startOf('week');
    const monthStart = moment().startOf('month');

    // 今日营收
    const todayResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: 6,
        settled_at: { [Op.gte]: today.toDate() }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('merchant_income_amount')), 'total']]
    });

    // 本周营收
    const weekResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: 6,
        settled_at: { [Op.gte]: weekStart.toDate() }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('merchant_income_amount')), 'total']]
    });

    // 本月营收
    const monthResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: 6,
        settled_at: { [Op.gte]: monthStart.toDate() }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('merchant_income_amount')), 'total']]
    });

    res.json(successResponse({
      balance: parseFloat(merchant.balance || 0).toFixed(2),
      todayIncome: parseFloat(todayResult?.dataValues?.total || 0).toFixed(2),
      weekIncome: parseFloat(weekResult?.dataValues?.total || 0).toFixed(2),
      monthIncome: parseFloat(monthResult?.dataValues?.total || 0).toFixed(2)
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 申请提现
 */
exports.applyWithdraw = async (req, res, next) => {
  try {
    const user = req.user;
    const { amount, bank_card, bank_name } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const withdrawAmount = parseFloat(amount);
    const balance = parseFloat(merchant.balance || 0);

    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json(errorResponse('提现金额不正确'));
    }

    if (withdrawAmount > balance) {
      return res.status(400).json(errorResponse('可提现余额不足'));
    }

    await merchant.update({
      balance: balance - withdrawAmount,
      withdrawn_amount: parseFloat(merchant.withdrawn_amount || 0) + withdrawAmount
    });

    res.json(successResponse({
      amount: withdrawAmount.toFixed(2),
      status: 'pending',
      message: '提现申请已提交，预计 1-3 个工作日到账'
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取提现记录
 */
exports.getWithdrawRecords = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 简化版本：返回空数组，实际可以创建 withdraw_records 表
    res.json(successResponse({
      list: [],
      total: 0
    }));
  } catch (error) {
    next(error);
  }
};
