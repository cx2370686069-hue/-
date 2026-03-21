const PAYMENT_CONFIG = require('../config/payment');

const round2 = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const computeTakeoutSettlement = (order) => {
  const totalAmount = round2(order.total_amount);
  const deliveryFee = round2(order.delivery_fee);
  const packageFee = round2(order.package_fee);
  const discountAmount = round2(order.discount_amount);

  const commissionRate = Number(PAYMENT_CONFIG?.businessRules?.commissionRate ?? 0);
  const riderShareOfCommission = Number(PAYMENT_CONFIG?.businessRules?.riderShareOfCommission ?? 0);

  const commissionAmount = round2(totalAmount * commissionRate);
  const riderIncentiveAmount = round2(commissionAmount * riderShareOfCommission);
  const platformIncomeAmount = round2(commissionAmount - riderIncentiveAmount);

  const merchantIncomeAmount = round2(totalAmount - commissionAmount + packageFee - discountAmount);
  const riderFee = round2(deliveryFee + riderIncentiveAmount);
  const payAmount = round2(totalAmount + deliveryFee + packageFee - discountAmount);

  return {
    payAmount,
    riderFee,
    commissionAmount,
    riderIncentiveAmount,
    platformIncomeAmount,
    merchantIncomeAmount
  };
};

const normalizePayChannel = (input) => {
  const v = String(input || '').trim().toLowerCase();
  if (!v) return 'mock';
  if (v === 'wechat' || v === 'wx') return 'wechat';
  if (v === 'alipay' || v === 'ali') return 'alipay';
  if (v === 'balance') return 'balance';
  if (v === 'mock') return 'mock';
  return v;
};

module.exports = {
  round2,
  computeTakeoutSettlement,
  normalizePayChannel
};

