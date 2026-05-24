const crypto = require('crypto');
const { Order, OrderLog, PaymentTransaction, CountyOrderGroup, Refund, sequelize } = require('../../models');
const { computeTakeoutSettlement, normalizePayChannel, round2 } = require('./utils');
const { generateOrderNo } = require('../../utils/helpers');

// 这个文件是“支付服务核心层”。
// 真正会改数据库状态的地方主要都在这里：
// 1. 创建预支付流水
// 2. 确认支付成功并回写订单 / 拼单组
// 3. 创建退款记录
const generateOutTradeNo = (orderNo) => {
  return `${orderNo}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
};

// 外卖订单支付成功后，很多分账字段要一起补齐。
// 这一步集中生成 patch，避免控制器和回调里到处手写一份。
const buildTakeoutSettlementPatch = (order) => {
  const settlement = computeTakeoutSettlement(order);
  return {
    pay_amount: settlement.payAmount,
    rider_fee: settlement.riderFee,
    commission_amount: settlement.commissionAmount,
    rider_incentive_amount: settlement.riderIncentiveAmount,
    platform_income_amount: settlement.platformIncomeAmount,
    merchant_income_amount: settlement.merchantIncomeAmount,
    settlement_rule_snapshot: settlement.settlementRule || order?.settlement_rule_snapshot || null
  };
};

// ==================== 预支付流水创建区 ====================
const createPrepay = async ({
  order,
  countyOrderGroup,
  channel,
  requestPayload,
  transaction: outerTransaction
} = {}) => {
  const normalizedChannel = normalizePayChannel(channel);
  const bizType = countyOrderGroup ? 'county_order_group' : 'order';
  const targetNo = countyOrderGroup?.group_no || order?.order_no;
  const amount = round2(countyOrderGroup?.pay_amount ?? order?.pay_amount);
  if (!targetNo || !Number.isFinite(amount)) {
    const err = new Error('缺少支付目标，无法创建预支付');
    err.statusCode = 400;
    throw err;
  }

  const outTradeNo = generateOutTradeNo(targetNo);
  const payload = requestPayload ? JSON.stringify(requestPayload) : null;
  const tx = await PaymentTransaction.create(
    {
      order_id: order?.id || null,
      group_id: countyOrderGroup?.id || null,
      biz_type: bizType,
      channel: normalizedChannel,
      out_trade_no: outTradeNo,
      amount,
      status: 'pending',
      request_payload: payload
    },
    outerTransaction ? { transaction: outerTransaction } : undefined
  );
  return tx;
};

// ==================== 支付成功确认区 ====================
// 第三方回调或 mock 成功后，最终都汇总到这里做事务处理。
const confirmSuccess = async ({
  outTradeNo,
  tradeNo,
  notifyId,
  amount,
  notifyPayload,
  channel
}) => {
  const normalizedChannel = normalizePayChannel(channel);
  const notifyPayloadStr = notifyPayload ? JSON.stringify(notifyPayload) : null;

  const result = await sequelize.transaction(async (t) => {
    const tx = await PaymentTransaction.findOne({
      where: { out_trade_no: outTradeNo },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!tx) {
      const err = new Error('支付交易不存在');
      err.statusCode = 404;
      throw err;
    }

    if (tx.status === 'success') {
      // 支付平台可能重复回调，所以这里要做幂等处理。
      const order = tx.order_id ? await Order.findByPk(tx.order_id, { transaction: t }) : null;
      const countyOrderGroup = tx.group_id
        ? await CountyOrderGroup.findByPk(tx.group_id, { transaction: t })
        : null;
      const orders = tx.group_id
        ? await Order.findAll({ where: { merge_group_id: tx.group_id }, transaction: t })
        : [];
      return { tx, order, countyOrderGroup, orders, alreadyProcessed: true };
    }

    const expectedAmount = round2(tx.amount);
    const incomingAmount = round2(amount === undefined || amount === null ? tx.amount : amount);
    if (expectedAmount !== incomingAmount) {
      const err = new Error('支付金额不一致');
      err.statusCode = 400;
      throw err;
    }

    await tx.update(
      {
        status: 'success',
        trade_no: tradeNo || tx.trade_no,
        notify_id: notifyId || tx.notify_id,
        notify_payload: notifyPayloadStr,
        paid_at: new Date()
      },
      { transaction: t }
    );

    if (tx.biz_type === 'county_order_group') {
      // 县城拼单是“一次支付，批量放行多笔订单”，所以这里要整组一起更新。
      const countyOrderGroup = await CountyOrderGroup.findByPk(tx.group_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!countyOrderGroup) {
        const err = new Error('拼单组不存在');
        err.statusCode = 404;
        throw err;
      }

      const orders = await Order.findAll({
        where: { merge_group_id: countyOrderGroup.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (countyOrderGroup.status === 0) {
        await countyOrderGroup.update(
          {
            status: 1,
            paid_at: new Date(),
            payment_channel: normalizedChannel
          },
          { transaction: t }
        );

        for (const order of orders) {
          if (order.status !== 0) {
            continue;
          }

          if (order.type === 'takeout') {
            await order.update(
              {
                status: 1,
                paid_at: new Date(),
                payment_channel: normalizedChannel,
                ...buildTakeoutSettlementPatch(order)
              },
              { transaction: t }
            );
          } else {
            await order.update(
              {
                status: 1,
                paid_at: new Date(),
                payment_channel: normalizedChannel,
                commission_amount: 0,
                rider_incentive_amount: 0,
                platform_income_amount: 0,
                merchant_income_amount: 0
              },
              { transaction: t }
            );
          }

          await OrderLog.create(
            {
              order_id: order.id,
              operator_type: 'system',
              action: '拼单支付回调',
              from_status: 0,
              to_status: 1,
              remark: `拼单组 ${countyOrderGroup.group_no} 支付成功`
            },
            { transaction: t }
          );
        }
      }

      return { tx, countyOrderGroup, orders, order: null, alreadyProcessed: false };
    }

    const order = await Order.findByPk(tx.order_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      const err = new Error('订单不存在');
      err.statusCode = 404;
      throw err;
    }

    if (order.status === 0) {
      if (order.type === 'takeout') {
        const settlement = computeTakeoutSettlement(order);
        if (round2(settlement.payAmount) !== round2(tx.amount)) {
          const err = new Error('订单金额与支付金额不一致');
          err.statusCode = 400;
          throw err;
        }
        await order.update(
          {
            status: 1,
            paid_at: new Date(),
            payment_channel: normalizedChannel,
            ...buildTakeoutSettlementPatch(order)
          },
          { transaction: t }
        );
      } else {
        await order.update(
          {
            status: 1,
            paid_at: new Date(),
            payment_channel: normalizedChannel,
            commission_amount: 0,
            rider_incentive_amount: 0,
            platform_income_amount: 0,
            merchant_income_amount: 0
          },
          { transaction: t }
        );
      }

      await OrderLog.create(
        {
          order_id: order.id,
          operator_type: 'system',
          action: '支付回调',
          from_status: 0,
          to_status: 1,
          remark: '支付成功'
        },
        { transaction: t }
      );
    }

    return { tx, order, countyOrderGroup: null, orders: [], alreadyProcessed: false };
  });

  const socketService = require('../../services/socketService');
  await socketService.broadcastDispatcherOrdersUpdate();
  return result;
};

// ==================== 退款记录区 ====================
const processRefund = async ({ order, reason_type, description, transaction }) => {
  if (!order || !order.id) throw new Error('退款必须提供订单');
  const t = transaction;

  const refund = await Refund.create({
    refund_no: generateOrderNo(),
    order_id: order.id,
    order_no: order.order_no,
    user_id: order.user_id,
    merchant_id: order.merchant_id,
    amount: order.pay_amount,
    reason_type: reason_type || '系统退款',
    description: description || '订单取消退款',
    status: 2, // 直接退款成功
    success_at: new Date()
  }, { transaction: t });

  await OrderLog.create({
    order_id: order.id,
    operator_type: 'system',
    action: '自动退款',
    from_status: order.status,
    to_status: 7,
    remark: `已发起全额退款 ${order.pay_amount} 元`
  }, { transaction: t });

  return refund;
};

module.exports = {
  createPrepay,
  confirmSuccess,
  processRefund
};
