const PAYMENT_CONFIG = require('./config');
const {
  SUPERMARKET_DELIVERY_MODES,
  SUPERMARKET_SETTLEMENT_RULES
} = require('../../config/supermarketDelivery');

// 这个文件放的是“支付模块通用计算工具”。
// 金额四舍五入、配送费估算、外卖订单结算拆账、支付渠道归一化，都集中在这里。
const round2 = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

// 县城配送费算法：默认按一套“起步里程 + 超出加价”规则来算。
const computeCountyDeliveryFee = (distanceKm, pricing) => {
  const baseDistanceKm = Number(pricing?.baseDistanceKm ?? 3);
  const baseFee = Number(pricing?.baseFee ?? 2.5);
  const extraPerKm = Number(pricing?.extraPerKm ?? 1);
  const extraKm = Math.max(0, distanceKm - baseDistanceKm);
  return round2(baseFee + extraKm * extraPerKm);
};

// 乡镇配送费算法和县城不是一套，这里单独拆开，后面调价时不容易误伤县城逻辑。
const computeTownDeliveryFee = (distanceKm, pricing) => {
  const baseDistanceKm = Number(pricing?.baseDistanceKm ?? 3);
  const baseFee = Number(pricing?.baseFee ?? 2.5);
  const midDistanceKm = Number(pricing?.midDistanceKm ?? 6);
  const midExtraPerKm = Number(pricing?.midExtraPerKm ?? 1.5);
  const longDistancePerKm = Number(pricing?.longDistancePerKm ?? 3);

  if (distanceKm <= baseDistanceKm) {
    return round2(baseFee);
  }

  if (distanceKm <= midDistanceKm) {
    return round2(baseFee + (distanceKm - baseDistanceKm) * midExtraPerKm);
  }

  const midTierFee = baseFee + (midDistanceKm - baseDistanceKm) * midExtraPerKm;
  return round2(midTierFee + (distanceKm - midDistanceKm) * longDistancePerKm);
};

// 对外统一暴露的配送费入口，内部再按订单类型选具体算法。
const computeDeliveryFee = ({ distanceKm, orderType }) => {
  const normalizedDistance = Number(distanceKm);
  if (!Number.isFinite(normalizedDistance) || normalizedDistance < 0) {
    return null;
  }

  const businessRules = PAYMENT_CONFIG?.businessRules || {};
  if (orderType === 'town') {
    return computeTownDeliveryFee(normalizedDistance, businessRules.townDeliveryPricing);
  }

  return computeCountyDeliveryFee(normalizedDistance, businessRules.deliveryPricing);
};

// 这里是“外卖订单结算拆账”的核心工具。
// 支付成功后，订单上的 pay_amount / rider_fee / platform_income_amount 等字段，都是按这里算。
const computeTakeoutSettlement = (order) => {
  const totalAmount = round2(order.total_amount);
  const deliveryFee = round2(order.delivery_fee);
  const packageFee = round2(order.package_fee);
  const discountAmount = round2(order.discount_amount);
  const payAmount = round2(totalAmount + deliveryFee + packageFee - discountAmount);
  const supermarketMode = String(order?.supermarket_delivery_mode || '').trim();

  if (supermarketMode === SUPERMARKET_DELIVERY_MODES.SELF_DELIVERY) {
    // 超市老板自己送：平台只收固定 3 元。
    const platformFee = 3;
    return {
      payAmount,
      riderFee: 0,
      commissionAmount: platformFee,
      riderIncentiveAmount: 0,
      platformIncomeAmount: platformFee,
      merchantIncomeAmount: round2(payAmount - platformFee),
      settlementRule: SUPERMARKET_SETTLEMENT_RULES.SELF_DELIVERY_FIXED
    };
  }

  if (supermarketMode === SUPERMARKET_DELIVERY_MODES.RIDER_DELIVERY) {
    // 超市交给骑手送：平台固定留 1 元，其余配送费给骑手。
    const platformFee = 1;
    return {
      payAmount,
      riderFee: round2(Math.max(0, deliveryFee - platformFee)),
      commissionAmount: platformFee,
      riderIncentiveAmount: 0,
      platformIncomeAmount: platformFee,
      merchantIncomeAmount: round2(totalAmount + packageFee - discountAmount),
      settlementRule: SUPERMARKET_SETTLEMENT_RULES.RIDER_DELIVERY_FIXED
    };
  }

  if (supermarketMode === SUPERMARKET_DELIVERY_MODES.PENDING) {
    // 还没决定最终配送方式时，先不结算，避免提前把钱拆错。
    return {
      payAmount,
      riderFee: 0,
      commissionAmount: 0,
      riderIncentiveAmount: 0,
      platformIncomeAmount: 0,
      merchantIncomeAmount: 0,
      settlementRule: SUPERMARKET_SETTLEMENT_RULES.HYBRID_PENDING
    };
  }

  const commissionRate = Number(PAYMENT_CONFIG?.businessRules?.commissionRate ?? 0);
  const riderShareOfCommission = Number(PAYMENT_CONFIG?.businessRules?.riderShareOfCommission ?? 0);

  const commissionAmount = round2(totalAmount * commissionRate);
  const riderIncentiveAmount = round2(commissionAmount * riderShareOfCommission);
  const platformIncomeAmount = round2(commissionAmount - riderIncentiveAmount);

  const merchantIncomeAmount = round2(totalAmount - commissionAmount + packageFee - discountAmount);
  const riderFee = round2(deliveryFee + riderIncentiveAmount);

  return {
    payAmount,
    riderFee,
    commissionAmount,
    riderIncentiveAmount,
    platformIncomeAmount,
    merchantIncomeAmount,
    settlementRule: SUPERMARKET_SETTLEMENT_RULES.DEFAULT
  };
};

// 前端可能传 wx / ali / wechat 之类的写法，这里统一成系统内部标准渠道名。
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
  computeDeliveryFee,
  computeTakeoutSettlement,
  normalizePayChannel
};
