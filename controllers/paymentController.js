const crypto = require('crypto');
const { Order } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { normalizePayChannel, round2 } = require('../utils/payment');
const paymentService = require('../services/paymentService');

const getOrderIdFromBody = (body) => {
  return body?.order_id || body?.orderId || body?.orderID || body?.id;
};

exports.prepay = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = getOrderIdFromBody(req.body);
    const channel = normalizePayChannel(req.body?.channel || req.body?.payMethod);

    const order = await Order.findOne({
      where: { id: orderId, user_id: user.id }
    });
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.status !== 0) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const tx = await paymentService.createPrepay({
      order,
      channel,
      requestPayload: { user_id: user.id, order_id: order.id, channel }
    });

    res.json(
      successResponse(
        {
          order_id: order.id,
          out_trade_no: tx.out_trade_no,
          amount: round2(tx.amount),
          channel: tx.channel,
          mode: process.env.PAYMENT_MODE || 'mock'
        },
        '预下单成功'
      )
    );
  } catch (error) {
    next(error);
  }
};

exports.mockConfirm = async (req, res, next) => {
  try {
    const user = req.user;
    const outTradeNo = req.body?.out_trade_no || req.body?.outTradeNo;
    if (!outTradeNo) {
      return res.status(400).json(errorResponse('缺少 out_trade_no'));
    }

    const tradeNo = `MOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const notifyId = `MOCK-NOTIFY-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const { tx, order } = await paymentService.confirmSuccess({
      outTradeNo,
      tradeNo,
      notifyId,
      amount: req.body?.amount,
      notifyPayload: { source: 'mockConfirm', user_id: user.id },
      channel: req.body?.channel || 'mock'
    });

    res.json(successResponse({ transaction: tx, order }, '支付成功'));
  } catch (error) {
    next(error);
  }
};

const requireNotifyTokenIfConfigured = (req) => {
  const required = process.env.PAYMENT_NOTIFY_TOKEN;
  if (!required) return true;
  const provided = req.headers['x-pay-token'];
  return provided === required;
};

const notifyHandler = async (req, res, next, channel) => {
  try {
    if (!requireNotifyTokenIfConfigured(req)) {
      return res.status(401).json(errorResponse('回调鉴权失败', 401));
    }

    const outTradeNo = req.body?.out_trade_no || req.body?.outTradeNo;
    const tradeNo = req.body?.trade_no || req.body?.tradeNo;
    const notifyId = req.body?.notify_id || req.body?.notifyId;
    const amount = req.body?.amount;

    if (!outTradeNo || amount === undefined || amount === null) {
      return res.status(400).json(errorResponse('回调参数不完整'));
    }

    await paymentService.confirmSuccess({
      outTradeNo,
      tradeNo,
      notifyId,
      amount,
      notifyPayload: req.body,
      channel
    });

    res.json({ code: 200, message: 'success' });
  } catch (error) {
    next(error);
  }
};

exports.wechatNotify = async (req, res, next) => notifyHandler(req, res, next, 'wechat');
exports.alipayNotify = async (req, res, next) => notifyHandler(req, res, next, 'alipay');

