// 这个文件是“商家财务控制器”。
// 商家余额概览、提现申请、提现记录，都是从这里处理。
const { Merchant, MerchantWithdrawRecord, Order, WalletLog, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const moment = require('moment');

// 这里统一创建带状态码的业务错误，方便事务里直接抛出后被外层捕获。
const createBizError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// 提现单号统一在这里生成，避免不同接口各自拼接格式。
const generateWithdrawNo = () => {
  const timePart = moment().format('YYYYMMDDHHmmss');
  const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `MW${timePart}${randomPart}`;
};

// 银行卡号对外只展示尾号，避免后台和前端直接回传完整卡号。
const maskBankCard = (value) => {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) {
    return '';
  }
  if (text.length <= 4) {
    return text;
  }
  return `****${text.slice(-4)}`;
};

// 提现记录分页参数统一从这里解析。
const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

/**
 * 获取财务统计数据
 * 这里主要返回商家余额、今日营收、本周营收、本月营收。
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

    // 今日营收只统计已完成并已结算的订单。
    const todayResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: 6,
        settled_at: { [Op.gte]: today.toDate() }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('merchant_income_amount')), 'total']]
    });

    // 本周营收。
    const weekResult = await Order.findOne({
      where: {
        merchant_id: merchant.id,
        status: 6,
        settled_at: { [Op.gte]: weekStart.toDate() }
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('merchant_income_amount')), 'total']]
    });

    // 本月营收。
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
 * 这里会在事务里同时扣减商家余额、创建提现记录、写钱包流水，保证账目一致。
 */
exports.applyWithdraw = async (req, res, next) => {
  try {
    const user = req.user;
    const { amount, bank_card, bank_name, remark } = req.body;

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

    let createdRecord = null;
    await sequelize.transaction(async (transaction) => {
      // 提现属于资金操作，所以这里先锁商家记录，再做余额校验和扣减。
      const lockedMerchant = await Merchant.findOne({
        where: { id: merchant.id, user_id: user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedMerchant) {
        throw createBizError('您还没有店铺', 404);
      }

      const currentBalance = parseFloat(lockedMerchant.balance || 0);
      if (withdrawAmount > currentBalance) {
        throw createBizError('可提现余额不足');
      }

      const balanceAfter = Number((currentBalance - withdrawAmount).toFixed(2));
      const appliedAt = new Date();
      const withdrawNo = generateWithdrawNo();

      await lockedMerchant.update({
        balance: balanceAfter,
        withdrawn_amount: parseFloat(lockedMerchant.withdrawn_amount || 0) + withdrawAmount
      }, { transaction });

      createdRecord = await MerchantWithdrawRecord.create({
        withdraw_no: withdrawNo,
        merchant_id: lockedMerchant.id,
        user_id: user.id,
        amount: withdrawAmount.toFixed(2),
        status: 'pending',
        bank_name: String(bank_name || '').trim() || null,
        bank_card: String(bank_card || '').replace(/\s+/g, '') || null,
        balance_before: currentBalance.toFixed(2),
        balance_after: balanceAfter.toFixed(2),
        applied_at: appliedAt,
        remark: String(remark || '').trim().slice(0, 255) || null
      }, { transaction });

      await WalletLog.create({
        user_id: user.id,
        role: 'merchant',
        type: 'withdraw',
        amount: withdrawAmount.toFixed(2),
        balance_after: balanceAfter.toFixed(2),
        title: '商家余额提现',
        remark: `提现申请单号：${withdrawNo}`
      }, { transaction });
    });

    res.json(successResponse({
      id: createdRecord.id,
      withdraw_no: createdRecord.withdraw_no,
      amount: Number(createdRecord.amount).toFixed(2),
      status: createdRecord.status,
      bank_name: createdRecord.bank_name || '',
      bank_card_masked: maskBankCard(createdRecord.bank_card),
      applied_at: createdRecord.applied_at,
      message: '提现申请已提交，预计 1-3 个工作日到账'
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取提现记录
 * 这里只返回当前商家自己的提现申请历史。
 */
exports.getWithdrawRecords = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { page, limit, offset } = parsePagination(req.query);
    const { rows, count } = await MerchantWithdrawRecord.findAndCountAll({
      where: { merchant_id: merchant.id },
      order: [['id', 'DESC']],
      limit,
      offset
    });

    res.json(successResponse({
      list: rows.map((record) => ({
        id: record.id,
        withdraw_no: record.withdraw_no,
        amount: Number(record.amount || 0).toFixed(2),
        status: record.status,
        bank_name: record.bank_name || '',
        bank_card_masked: maskBankCard(record.bank_card),
        applied_at: record.applied_at || record.created_at || null,
        processed_at: record.processed_at || null,
        remark: record.remark || ''
      })),
      total: count,
      page,
      limit
    }));
  } catch (error) {
    next(error);
  }
};
