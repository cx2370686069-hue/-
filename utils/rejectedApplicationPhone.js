const { Op } = require('sequelize');
const { User, Merchant } = require('../models');

// 这个文件是“驳回申请手机号释放工具”。
// 当商家或骑手申请被驳回后，这里负责把原手机号占用释放掉，同时保留审核痕迹，方便用户重新申请。
const RIDER_REJECTED_STATUS = 2;
const MERCHANT_REJECTED_STATUS = 2;
const RELEASED_PHONE_PREFIX_MAP = {
  rider: 'R',
  merchant: 'M',
  default: 'X'
};

const normalizePhone = (value) => String(value || '').trim();

// 生成一个不会和真实手机号冲突的“占位手机号”，用于释放原号码占用。
const buildReleasedPhoneValue = (userId, scope = 'default', attempt = 0) => {
  const prefix = RELEASED_PHONE_PREFIX_MAP[scope] || RELEASED_PHONE_PREFIX_MAP.default;
  const userPart = String(Math.max(Number(userId) || 0, 0) % 100000).padStart(5, '0');
  const timeSeed = Date.now() + attempt;
  const timePart = String(timeSeed).slice(-5);
  return `${prefix}${userPart}${timePart}`.slice(0, 11);
};

const generateUniqueReleasedPhoneValue = async (userId, scope, transaction) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = buildReleasedPhoneValue(userId, scope, attempt);
    const existing = await User.findOne({
      where: { phone: candidate },
      attributes: ['id'],
      transaction
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('释放驳回申请手机号失败，请稍后重试');
};

// 统一释放某个用户账号当前占用的手机号。
const releaseUserPhone = async (user, { scope = 'default', transaction } = {}) => {
  if (!user || !user.id) {
    return null;
  }

  const nextPhone = await generateUniqueReleasedPhoneValue(user.id, scope, transaction);
  await user.update({
    phone: nextPhone,
    status: 0
  }, { transaction });

  return nextPhone;
};

// 清理被驳回骑手 / 商家自配送员历史记录里的手机号占用。
const releaseRejectedRiderPhoneOccupation = async (phone, transaction) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return 0;
  }

  const riders = await User.findAll({
    where: {
      phone: normalizedPhone,
      role: { [Op.in]: ['rider', 'merchant_delivery'] },
      rider_audit_status: RIDER_REJECTED_STATUS
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });

  for (const rider of riders) {
    await releaseUserPhone(rider, {
      scope: 'rider',
      transaction
    });
  }

  return riders.length;
};

// 清理被驳回商家申请的手机号占用。
const releaseRejectedMerchantPhoneOccupation = async (phone, transaction) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return 0;
  }

  const users = await User.findAll({
    where: {
      phone: normalizedPhone,
      role: 'merchant'
    },
    include: [
      {
        model: Merchant,
        as: 'merchant',
        attributes: ['id', 'audit_status'],
        required: true
      }
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });

  let releasedCount = 0;
  for (const user of users) {
    if (Number(user.merchant?.audit_status) !== MERCHANT_REJECTED_STATUS) {
      continue;
    }

    await releaseUserPhone(user, {
      scope: 'merchant',
      transaction
    });
    releasedCount += 1;
  }

  return releasedCount;
};

// 已经查到某个 merchant(商家) 记录时，从这里直接释放其商家账号手机号。
const releaseMerchantUserPhoneByMerchant = async (merchant, transaction) => {
  if (!merchant?.user_id) {
    return null;
  }

  const user = await User.findByPk(merchant.user_id, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });

  if (!user) {
    return null;
  }

  return releaseUserPhone(user, {
    scope: 'merchant',
    transaction
  });
};

module.exports = {
  releaseUserPhone,
  releaseRejectedRiderPhoneOccupation,
  releaseRejectedMerchantPhoneOccupation,
  releaseMerchantUserPhoneByMerchant
};
