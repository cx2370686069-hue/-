const crypto = require('crypto');
const { Order, OrderLog, PaymentTransaction, sequelize } = require('../models');
const { computeTakeoutSettlement, normalizePayChannel, round2 } = require('../utils/payment');

const generateOutTradeNo = (orderNo) => {
  return `${orderNo}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
};

const createPrepay = async ({ order, channel, requestPayload, transaction: outerTransaction } = {}) => {
  const normalizedChannel = normalizePayChannel(channel);
  const outTradeNo = generateOutTradeNo(order.order_no);
  const amount = round2(order.pay_amount);
  const payload = requestPayload ? JSON.stringify(requestPayload) : null;
  const tx = await PaymentTransaction.create(
    {
      order_id: order.id,
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

  return sequelize.transaction(async (t) => {
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
      const order = await Order.findByPk(tx.order_id, { transaction: t });
      return { tx, order, alreadyProcessed: true };
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
            pay_amount: settlement.payAmount,
            rider_fee: settlement.riderFee,
            commission_amount: settlement.commissionAmount,
            rider_incentive_amount: settlement.riderIncentiveAmount,
            platform_income_amount: settlement.platformIncomeAmount,
            merchant_income_amount: settlement.merchantIncomeAmount
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

    return { tx, order, alreadyProcessed: false };
  });
};

module.exports = {
  createPrepay,
  confirmSuccess
};

