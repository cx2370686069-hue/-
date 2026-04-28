const { User, Merchant, ServiceArea, UserPhoneChangeLog, sequelize } = require('../models');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');
const {
  normalizeMerchantCategory,
  isValidMerchantCategory,
  getMerchantCategoryErrorMessage
} = require('../config/merchantCategories');
const {
  SUPERMARKET_DELIVERY_PERMISSIONS,
  normalizeSupermarketDeliveryPermission
} = require('../config/supermarketDelivery');

const SUPERMARKET_CATEGORY = '超市';
const NORMAL_SUPERMARKET_CHANNEL_LABEL = '普通超市';
const PHONE_CHANGE_LIMIT_PER_YEAR = 2;

const normalizeText = (value) => String(value || '').trim();

const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

const isValidChinaMainlandPhone = (phone) => /^1\d{10}$/.test(phone);

const normalizeCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeMerchantChannelTags = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const source = Array.isArray(value) ? value.join(',') : String(value);
  const tags = source
    .split(/[,，|]/)
    .map((item) => String(item || '').trim())
    .filter((item) => item && item !== NORMAL_SUPERMARKET_CHANNEL_LABEL);
  if (!tags.length) {
    return null;
  }
  return Array.from(new Set(tags)).join(',').slice(0, 255);
};

const pickFirstDefinedValue = (payload = {}, fields = []) => {
  for (const field of fields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      return payload[field];
    }
  }
  return null;
};

const resolveMerchantChannelTags = (payload = {}) => {
  return normalizeMerchantChannelTags(
    pickFirstDefinedValue(payload, [
      'channel_tags',
      'channelTags',
      'business_direction',
      'businessDirection',
      'supermarket_sub_channel',
      'supermarketSubChannel',
      'supermarket_subtype',
      'supermarketSubtype',
      'sub_channel',
      'subChannel',
      'store_direction',
      'storeDirection'
    ])
  );
};

const hasValidLocationPair = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
};

const buildAuthPayload = (user, extra = {}) => ({
  user: {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    rider_status: user.rider_status,
    rider_balance: user.rider_balance,
    rider_kind: user.rider_kind,
    rider_town: user.rider_town,
    delivery_scope: user.delivery_scope,
    rider_level: user.rider_level,
    town_code: user.town_code,
    town_name: user.town_name,
    ...extra
  },
  token: generateToken(user.id)
});

const loadMerchantAuthExtra = async (userId) => {
  const merchant = await Merchant.findOne({
    where: { user_id: userId },
    attributes: ['id', 'audit_status', 'business_scope', 'town_code', 'town_name', 'supermarket_delivery_permission']
  });

  if (!merchant) {
    return null;
  }

  return {
    merchant_id: merchant.id,
    audit_status: merchant.audit_status,
    business_scope: merchant.business_scope,
    town_code: merchant.town_code,
    town_name: merchant.town_name,
    supermarket_delivery_permission: merchant.supermarket_delivery_permission,
    merchant: {
      id: merchant.id,
      audit_status: merchant.audit_status,
      business_scope: merchant.business_scope,
      town_code: merchant.town_code,
      town_name: merchant.town_name,
      supermarket_delivery_permission: merchant.supermarket_delivery_permission
    }
  };
};

const validateSupermarketDeliveryPermission = (merchantCategory, rawPermission) => {
  if (merchantCategory !== SUPERMARKET_CATEGORY) {
    return { value: null };
  }

  const normalized = normalizeSupermarketDeliveryPermission(rawPermission);
  if (!normalized) {
    return { error: '超市商家必须选择配送方式：自己配送、骑手配送或两个都支持' };
  }

  if (!Object.values(SUPERMARKET_DELIVERY_PERMISSIONS).includes(normalized)) {
    return { error: '超市配送方式参数不正确' };
  }

  return { value: normalized };
};

const resolveTownArea = async (townCode, transaction) => {
  const areaCode = normalizeText(townCode);
  if (!areaCode) {
    return null;
  }

  return ServiceArea.findOne({
    where: {
      area_code: areaCode,
      area_type: 'town',
      is_enabled: true
    },
    transaction
  });
};

const getCurrentYear = () => new Date().getFullYear();

const getPhoneChangeStats = async (userId, year = getCurrentYear(), transaction) => {
  const usedCount = await UserPhoneChangeLog.count({
    where: {
      user_id: userId,
      change_year: year
    },
    transaction
  });

  return {
    year,
    limit: PHONE_CHANGE_LIMIT_PER_YEAR,
    used: usedCount,
    remaining: Math.max(PHONE_CHANGE_LIMIT_PER_YEAR - usedCount, 0)
  };
};

const appendPhoneChangeStats = async (payload, userId, transaction) => {
  const stats = await getPhoneChangeStats(userId, getCurrentYear(), transaction);
  return {
    ...payload,
    phone_change_limit_per_year: stats.limit,
    phone_change_used_this_year: stats.used,
    phone_change_remaining_this_year: stats.remaining
  };
};

/**
 * 用户注册
 */
exports.register = async (req, res, next) => {
  try {
    const phone = normalizeText(req.body.phone);
    const password = req.body.password;
    const nickname = normalizeText(req.body.nickname);
    const role = normalizeText(req.body.role || 'user');

    // 参数验证
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    if (role !== 'user') {
      return res.status(400).json(errorResponse('商家和骑手请使用专用注册入口'));
    }

    // 检查手机号是否已存在
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return res.status(400).json(errorResponse('该手机号已注册'));
    }

    // 创建用户
    const user = await User.create({
      phone,
      password,
      nickname: nickname || `用户${phone.slice(-4)}`,
      role: 'user',
      status: 1
    });

    // 生成 token
    const token = generateToken(user.id);

    res.status(201).json(successResponse({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role
      },
      token
    }, '注册成功'));
  } catch (error) {
    next(error);
  }
};

exports.registerMerchant = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const phone = normalizeText(req.body.phone);
    const password = req.body.password;
    const nickname = normalizeText(req.body.nickname) || `商家${phone.slice(-4)}`;
    const businessScope = normalizeText(req.body.business_scope);
    const townCode = normalizeText(req.body.town_code);
    const merchantName = normalizeText(req.body.store_name || req.body.name);
    const businessLicense = normalizeText(req.body.business_license);
    const merchantCategory = normalizeMerchantCategory(req.body.category);
    const supermarketDeliveryPermissionCheck = validateSupermarketDeliveryPermission(
      merchantCategory,
      req.body.supermarket_delivery_permission ?? req.body.delivery_permission
    );
    const latitude = normalizeCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = normalizeCoordinate(req.body.longitude ?? req.body.lng);

    if (!phone || !password || !merchantName || !businessScope || !merchantCategory) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('手机号、密码、店铺名称、商家业务线、主营类目不能为空'));
    }

    if (!businessLicense) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('营业执照不能为空'));
    }

    if (latitude === null || longitude === null) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('店铺位置不能为空，请先完成地图选点'));
    }

    if (!hasValidLocationPair(latitude, longitude)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('店铺地图坐标无效，请重新地图选点后再提交'));
    }

    if (!isValidMerchantCategory(merchantCategory)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse(getMerchantCategoryErrorMessage()));
    }

    if (supermarketDeliveryPermissionCheck.error) {
      await transaction.rollback();
      return res.status(400).json(errorResponse(supermarketDeliveryPermissionCheck.error));
    }

    if (!['county_food', 'town_food'].includes(businessScope)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('商家业务线参数不正确'));
    }

    if (businessScope === 'county_food' && townCode) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('县城商家不能绑定乡镇'));
    }

    if (businessScope === 'town_food' && !townCode) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('乡镇商家必须绑定乡镇'));
    }

    const existingUser = await User.findOne({ where: { phone }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('该手机号已注册'));
    }

    let townArea = null;
    if (businessScope === 'town_food') {
      townArea = await resolveTownArea(townCode, transaction);
      if (!townArea) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('所选乡镇不存在或已停用'));
      }
    }

    const user = await User.create({
      phone,
      password,
      nickname,
      role: 'merchant',
      status: 1
    }, { transaction });

    const merchant = await Merchant.create({
      user_id: user.id,
      name: merchantName,
      phone: normalizeText(req.body.contact_phone || req.body.phone) || phone,
      description: normalizeText(req.body.description) || null,
      address: normalizeText(req.body.address) || null,
      latitude,
      longitude,
      category: merchantCategory,
      channel_tags: resolveMerchantChannelTags(req.body),
      business_license: businessLicense,
      logo: normalizeText(req.body.logo) || null,
      cover: normalizeText(req.body.cover) || null,
      business_scope: businessScope,
      town_code: townArea ? townArea.area_code : null,
      town_name: townArea ? townArea.area_name : null,
      supermarket_delivery_permission: supermarketDeliveryPermissionCheck.value,
      audit_status: 0,
      status: 1
    }, { transaction });

    await transaction.commit();

    res.status(201).json(successResponse({
      ...buildAuthPayload(user, {
        merchant_id: merchant.id,
        audit_status: merchant.audit_status,
        business_scope: merchant.business_scope,
        town_code: merchant.town_code,
        town_name: merchant.town_name,
        supermarket_delivery_permission: merchant.supermarket_delivery_permission
      }),
      merchant: {
        id: merchant.id,
        name: merchant.name,
        business_scope: merchant.business_scope,
        town_code: merchant.town_code,
        town_name: merchant.town_name,
        audit_status: merchant.audit_status,
        supermarket_delivery_permission: merchant.supermarket_delivery_permission
      }
    }, '商家注册成功'));
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.registerRider = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const phone = normalizeText(req.body.phone);
    const password = req.body.password;
    const nickname = normalizeText(req.body.nickname) || `骑手${phone.slice(-4)}`;
    const deliveryScope = normalizeText(req.body.delivery_scope);
    const townCode = normalizeText(req.body.town_code);

    if (!phone || !password || !deliveryScope) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('手机号、密码、配送业务线不能为空'));
    }

    if (!['county_delivery', 'town_delivery'].includes(deliveryScope)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('配送业务线参数不正确'));
    }

    if (deliveryScope === 'county_delivery' && townCode) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('县城骑手不能绑定乡镇'));
    }

    if (deliveryScope === 'town_delivery' && !townCode) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('乡镇骑手必须绑定乡镇'));
    }

    const existingUser = await User.findOne({ where: { phone }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('该手机号已注册'));
    }

    let townArea = null;
    if (deliveryScope === 'town_delivery') {
      townArea = await resolveTownArea(townCode, transaction);
      if (!townArea) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('所选乡镇不存在或已停用'));
      }
    }

    const user = await User.create({
      phone,
      password,
      nickname,
      role: 'rider',
      status: 0,
      rider_audit_status: 0,
      delivery_scope: deliveryScope,
      rider_level: deliveryScope === 'town_delivery' ? 'captain' : 'normal',
      town_code: townArea ? townArea.area_code : null,
      town_name: townArea ? townArea.area_name : null,
      rider_kind: deliveryScope === 'town_delivery' ? 'stationmaster' : 'rider',
      rider_town: townArea ? townArea.area_name : null
    }, { transaction });

    await transaction.commit();

    res.status(201).json(successResponse(buildAuthPayload(user), '骑手注册成功'));
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * 用户登录
 */
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // 参数验证
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    // 查询用户
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(400).json(errorResponse('用户不存在'));
    }

    // 验证密码
    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(400).json(errorResponse('密码错误'));
    }

    // 检查用户状态
    if (user.status !== 1) {
      return res.status(403).json(errorResponse('账号已被禁用'));
    }

    const merchantExtra = user.role === 'merchant'
      ? await loadMerchantAuthExtra(user.id)
      : null;

    const authPayload = buildAuthPayload(user, merchantExtra || {});
    if (merchantExtra?.merchant) {
      authPayload.merchant = merchantExtra.merchant;
    }

    res.json(successResponse(authPayload, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户信息
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    const merchantExtra = user.role === 'merchant'
      ? await loadMerchantAuthExtra(user.id)
      : null;

    const payload = await appendPhoneChangeStats({
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
      rider_status: user.rider_status,
      rider_balance: user.rider_balance,
      rider_kind: user.rider_kind,
      rider_town: user.rider_town,
      delivery_scope: user.delivery_scope,
      rider_level: user.rider_level,
      town_code: user.town_code,
      town_name: user.town_name,
      ...(merchantExtra ? {
        merchant_id: merchantExtra.merchant_id,
        audit_status: merchantExtra.audit_status,
        business_scope: merchantExtra.business_scope,
        town_code: merchantExtra.town_code,
        town_name: merchantExtra.town_name,
        supermarket_delivery_permission: merchantExtra.supermarket_delivery_permission
      } : {})
    }, user.id);

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户信息
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const { nickname, avatar } = req.body;

    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;

    await user.save();

    const payload = await appendPhoneChangeStats({
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role
    }, user.id);

    res.json(successResponse(payload, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 修改手机号
 * 当前先采用登录密码校验方案，后续可升级为短信验证码换绑
 */
exports.changePhone = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const authUser = req.user;
    const newPhone = normalizePhone(req.body.new_phone ?? req.body.phone);
    const password = req.body.password;
    const year = getCurrentYear();

    if (!newPhone || !password) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('新手机号和当前登录密码不能为空'));
    }
    if (!isValidChinaMainlandPhone(newPhone)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('新手机号格式不正确'));
    }

    const user = await User.findByPk(authUser.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user || user.status !== 1) {
      await transaction.rollback();
      return res.status(401).json(errorResponse('登录已失效'));
    }
    if (newPhone === user.phone) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('新手机号不能与当前手机号相同'));
    }

    const passwordMatched = await user.validatePassword(password);
    if (!passwordMatched) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('当前登录密码错误'));
    }

    const phoneOwner = await User.findOne({
      where: { phone: newPhone },
      transaction
    });
    if (phoneOwner && Number(phoneOwner.id) !== Number(user.id)) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('该手机号已被其他账号使用'));
    }

    const stats = await getPhoneChangeStats(user.id, year, transaction);
    if (stats.used >= PHONE_CHANGE_LIMIT_PER_YEAR) {
      await transaction.rollback();
      return res.status(400).json(errorResponse(`当前账号${year}年内最多只能修改${PHONE_CHANGE_LIMIT_PER_YEAR}次手机号`));
    }

    const oldPhone = user.phone;
    user.phone = newPhone;
    await user.save({ transaction });

    await UserPhoneChangeLog.create({
      user_id: user.id,
      old_phone: oldPhone,
      new_phone: newPhone,
      change_year: year,
      verify_method: 'password'
    }, { transaction });

    await transaction.commit();

    const payload = await appendPhoneChangeStats({
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role
    }, user.id);

    res.json(successResponse(payload, '手机号修改成功'));
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};
