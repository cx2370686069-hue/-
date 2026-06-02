const { Order } = require('../../models');
const Merchant = require('../../models/Merchant');
const socketService = require('../../services/socketService');
const { successResponse, errorResponse } = require('../../utils/helpers');
const { normalizePayChannel, round2 } = require('./utils');
const paymentService = require('./service');

// 这个文件是“支付控制器”。
// 它主要负责三类入口：
// 1. 用户发起预支付
// 2. 微信 / 支付宝支付回调进来后的控制层处理
const getOrderIdFromBody = (body) => {
  return body?.order_id || body?.orderId || body?.orderID || body?.id;
};

const isProduction = () => process.env.NODE_ENV === 'production';

// 支付成功后，这里顺手把新订单消息推给相关商家端。
const notifyMerchantsForOrders = async (orders = []) => {
  for (const order of orders) {
    if (!order?.merchant_id) {
      continue;
    }
    const merchant = await Merchant.findByPk(order.merchant_id);
    if (merchant?.user_id) {
      socketService.notifyMerchantNewOrder(merchant.user_id, order);
    }
  }
};

// ==================== 用户支付发起区 ====================
// 用户点“去支付”后，先走这里做订单归属校验，再交给 service(服务层) 创建支付流水。
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

/**
 * 支付回调辅助 token（生产环境强制要求设置，可作为反向代理白名单的二次保险）
 *
 * 注意：这并不是真正的支付签名校验。微信/支付宝官方回调必须做：
 *   - 验证 Wechatpay-Signature / 支付宝公钥签名
 *   - 校验回调中携带的 mch_id / app_id 是否为本系统配置
 * 在 wechatNotify / alipayNotify 内的 verifySignature 调用必须替换为真实验签实现。
 */
const requireNotifyToken = (req) => {
  const required = process.env.PAYMENT_NOTIFY_TOKEN;
  if (!required) {
    if (isProduction()) {
      return { ok: false, code: 503, message: '回调入口未正确配置' };
    }
    return { ok: true };
  }
  const provided = req.headers['x-pay-token'];
  if (provided !== required) {
    return { ok: false, code: 401, message: '回调鉴权失败' };
  }
  return { ok: true };
};

/**
 * 真实签名校验占位：必须由各支付渠道接入方实现
 *  - wechat: 校验 Wechatpay-Serial / Wechatpay-Signature 等头部
 *  - alipay: 用 alipay 公钥校验 sign 字段
 * 当前以"返回 true 但记录警告"的方式占位，配合 token 二次保险，
 * 上线前必须替换为真实实现。
 */
const verifyChannelSignature = (req, channel) => {
  // TODO(payment): 实现真实的支付渠道签名校验
  if (process.env.PAYMENT_REQUIRE_CHANNEL_SIGNATURE === 'true') {
    return false; // 强制开启签名校验但尚未实现，直接拒绝，避免被绕过
  }
  if (!isProduction()) {
    return true;
  }
  // 生产环境且未显式声明已实现签名校验时，仅当配置了 token 才允许通过
  return Boolean(process.env.PAYMENT_NOTIFY_TOKEN);
};

// ==================== 第三方支付回调区 ====================
// 微信和支付宝都会汇总到这里处理，前面做入口鉴权，后面统一交给 service(服务层) 落库改订单状态。
const notifyHandler = async (req, res, next, channel) => {
  try {
    const tokenCheck = requireNotifyToken(req);
    if (!tokenCheck.ok) {
      return res.status(tokenCheck.code).json(errorResponse(tokenCheck.message, tokenCheck.code));
    }

    if (!verifyChannelSignature(req, channel)) {
      return res.status(401).json(errorResponse('支付回调签名校验失败', 401));
    }

    const outTradeNo = req.body?.out_trade_no || req.body?.outTradeNo;
    const tradeNo = req.body?.trade_no || req.body?.tradeNo;
    const notifyId = req.body?.notify_id || req.body?.notifyId;

    if (!outTradeNo) {
      return res.status(400).json(errorResponse('回调参数不完整'));
    }

    // 关键：amount 不再从 req.body 取，完全以服务端 PaymentTransaction.amount 为权威，
    // 避免攻击者通过伪造回调修改成功金额
    const { tx, order, countyOrderGroup, orders } = await paymentService.confirmSuccess({
      outTradeNo,
      tradeNo,
      notifyId,
      amount: undefined,
      notifyPayload: req.body,
      channel
    });

    if (order?.merchant_id) {
      const merchant = await Merchant.findByPk(order.merchant_id);
      if (merchant?.user_id) {
        socketService.notifyMerchantNewOrder(merchant.user_id, order);
      }
    }
    await notifyMerchantsForOrders(orders);

    res.json({
      code: 200,
      message: 'success',
      transaction_id: tx?.id,
      order_id: order?.id,
      group_id: countyOrderGroup?.id || null
    });
  } catch (error) {
    next(error);
  }
};

exports.wechatNotify = async (req, res, next) => notifyHandler(req, res, next, 'wechat');
exports.alipayNotify = async (req, res, next) => notifyHandler(req, res, next, 'alipay');
