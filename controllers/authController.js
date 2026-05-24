// 这个文件是“账号认证总控制器”。
// 普通用户注册、商家注册、骑手注册、登录、当前用户信息、资料修改、换绑手机号，都是从这里进。
const { User, Merchant, ServiceArea, UserPhoneChangeLog, sequelize } = require('../models');
const { Op } = require('sequelize');
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
const {
  normalizeMerchantBindingCode,
  isValidMerchantBindingCode,
  generateUniqueMerchantBindingCode
} = require('../utils/merchantBinding');
const {
  releaseRejectedRiderPhoneOccupation,
  releaseRejectedMerchantPhoneOccupation
} = require('../utils/rejectedApplicationPhone');

const SUPERMARKET_CATEGORY = '超市';
const NORMAL_SUPERMARKET_CHANNEL_LABEL = '普通超市';
const PHONE_CHANGE_LIMIT_PER_YEAR = 2;

// ==================== 基础清洗与角色常量区 ====================
// 这一段主要负责清洗手机号、坐标、渠道标签，并统一账号角色边界。
const normalizeText = (value) => String(value || '').trim();

const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

const MERCHANT_DELIVERY_ROLE = 'merchant_delivery';
const MERCHANT_ROLE_GROUP = ['merchant'];
const RIDER_ROLE_GROUP = ['rider', MERCHANT_DELIVERY_ROLE];
const LOGIN_SCENES = {
  MERCHANT_APP: 'merchant_app',
  RIDER_APP: 'rider_app'
};

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

// ==================== 登录态与账号附加信息组装区 ====================
// 登录成功后，前端不只需要 token，还需要商家绑定信息、配送域等扩展字段。
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

const findUserByPhoneAndRoles = async (phone, roles, transaction) => {
  return User.findOne({
    where: {
      phone,
      role: { [Op.in]: roles }
    },
    order: [['id', 'DESC']],
    transaction
  });
};

// 根据不同端的登录场景，限制能登录的角色范围。
// 比如商家端只能登录商家账号，骑手端只能登录骑手/自配送员账号。
const normalizeLoginScene = (payload = {}) => {
  const rawValue = normalizeText(
    payload.login_scene ??
    payload.loginScene ??
    payload.app_scene ??
    payload.appScene ??
    payload.client_type ??
    payload.clientType
  ).toLowerCase();

  if (['merchant', 'merchant_app', 'merchant-client', 'merchant_client'].includes(rawValue)) {
    return LOGIN_SCENES.MERCHANT_APP;
  }

  if (['rider', 'rider_app', 'rider-client', 'rider_client'].includes(rawValue)) {
    return LOGIN_SCENES.RIDER_APP;
  }

  return '';
};

const resolveLoginRolesByScene = (scene) => {
  if (scene === LOGIN_SCENES.MERCHANT_APP) {
    return MERCHANT_ROLE_GROUP;
  }
  if (scene === LOGIN_SCENES.RIDER_APP) {
    return RIDER_ROLE_GROUP;
  }
  return [];
};

const getMissingAccountMessageByScene = (scene) => {
  if (scene === LOGIN_SCENES.MERCHANT_APP) {
    return '当前手机号未注册商家账号';
  }
  if (scene === LOGIN_SCENES.RIDER_APP) {
    return '当前手机号未注册骑手账号';
  }
  return '用户不存在';
};

// ==================== 商家 / 骑手注册前置校验区 ====================
// 这一区主要准备绑定码、服务区域、配送权限、手机号换绑次数等公共能力。
const createMerchantBindingCode = async (transaction) => {
  return generateUniqueMerchantBindingCode(async (candidate) => {
    const existing = await Merchant.findOne({
      where: { binding_code: candidate },
      attributes: ['id'],
      transaction
    });
    return Boolean(existing);
  });
};

const loadMerchantAuthExtra = async (userId) => {
  const merchant = await Merchant.findOne({
    where: { user_id: userId },
    attributes: ['id', 'binding_code', 'audit_status', 'business_scope', 'town_code', 'town_name', 'supermarket_delivery_permission']
  });

  if (!merchant) {
    return null;
  }

  return {
    merchant_id: merchant.id,
    merchant_binding_code: merchant.binding_code,
    audit_status: merchant.audit_status,
    business_scope: merchant.business_scope,
    town_code: merchant.town_code,
    town_name: merchant.town_name,
    supermarket_delivery_permission: merchant.supermarket_delivery_permission,
    merchant: {
      id: merchant.id,
      binding_code: merchant.binding_code,
      audit_status: merchant.audit_status,
      business_scope: merchant.business_scope,
      town_code: merchant.town_code,
      town_name: merchant.town_name,
      supermarket_delivery_permission: merchant.supermarket_delivery_permission
    }
  };
};

const loadMerchantDeliveryAuthExtra = async (user) => {
  if (!user?.bound_merchant_id) {
    return null;
  }

  const merchant = await Merchant.findByPk(user.bound_merchant_id, {
    attributes: ['id', 'binding_code', 'name', 'address', 'business_scope', 'town_code', 'town_name', 'status', 'audit_status']
  });

  if (!merchant) {
    return {
      delivery_domain: 'merchant_self_delivery',
      bound_merchant_id: user.bound_merchant_id
    };
  }

  return {
    delivery_domain: 'merchant_self_delivery',
    merchant_id: merchant.id,
    bound_merchant_id: merchant.id,
    merchant_binding_code: merchant.binding_code,
    merchant_name: merchant.name,
    merchant_address: merchant.address,
    business_scope: merchant.business_scope,
    town_code: merchant.town_code,
    town_name: merchant.town_name,
    merchant: {
      id: merchant.id,
      binding_code: merchant.binding_code,
      name: merchant.name,
      address: merchant.address,
      business_scope: merchant.business_scope,
      town_code: merchant.town_code,
      town_name: merchant.town_name,
      status: merchant.status,
      audit_status: merchant.audit_status
    }
  };
};

const resolveRiderRegistrationRole = (payload = {}) => {
  const rawValue = normalizeText(
    payload.registration_role ??
    payload.registrationRole ??
    payload.delivery_role ??
    payload.deliveryRole ??
    payload.role
  );

  return ['merchant_delivery', 'merchant_self_delivery', 'merchant_delivery_agent'].includes(rawValue)
    ? MERCHANT_DELIVERY_ROLE
    : 'rider';
};

const findBindableMerchantByCode = async (bindingCode, transaction) => {
  return Merchant.findOne({
    where: {
      binding_code: bindingCode,
      status: 1,
      audit_status: 1
    },
    attributes: ['id', 'binding_code', 'name', 'address', 'business_scope', 'town_code', 'town_name', 'status', 'audit_status'],
    transaction
  });
};

const validateSupermarketDeliveryPermission = (_merchantCategory, rawPermission) => {
  const normalized = normalizeSupermarketDeliveryPermission(rawPermission);
  if (!normalized) {
    return { error: '店铺必须选择配送方式：自己配送、骑手配送或两个都支持' };
  }

  if (!Object.values(SUPERMARKET_DELIVERY_PERMISSIONS).includes(normalized)) {
    return { error: '店铺配送方式参数不正确' };
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
 * 普通用户注册
 * 这里只处理 role=user 的普通用户，商家和骑手必须走各自专用注册入口。
 */
exports.register = async (req, res, next) => {
  try {
    const phone = normalizeText(req.body.phone);
    const password = req.body.password;
    const nickname = normalizeText(req.body.nickname);
    const role = normalizeText(req.body.role || 'user');

    // 先拦最基本的必填参数和角色边界。
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    if (role !== 'user') {
      return res.status(400).json(errorResponse('商家和骑手请使用专用注册入口'));
    }

    // 普通用户注册前，先检查手机号是否已经被占用。
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return res.status(400).json(errorResponse('该手机号已注册'));
    }

    // 这里才真正创建普通用户账号。
    const user = await User.create({
      phone,
      password,
      nickname: nickname || `用户${phone.slice(-4)}`,
      role: 'user',
      status: 1
    });

    // 注册成功后直接返回登录态，前端不用再额外调一次登录接口。
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

/**
 * 商家注册
 * 这里会在一个事务里同时创建商家账号和商家资料，并校验业务线、主营类目、地图坐标、乡镇归属。
 */
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

    // 商家注册先做必填校验，避免创建到一半才发现关键字段缺失。
    if (!phone || !password || !merchantName || !businessScope || !merchantCategory) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('手机号、密码、店铺名称、商家业务线、主营类目不能为空'));
    }

    if (!businessLicense) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('营业执照不能为空'));
    }

    // 地图坐标是商家配送范围的重要基础，所以这里必须拦严。
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

    // 商家注册前，先清理这个手机号历史上“已驳回”的占用记录。
    await releaseRejectedMerchantPhoneOccupation(phone, transaction);

    const existingUser = await findUserByPhoneAndRoles(phone, MERCHANT_ROLE_GROUP, transaction);
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('该手机号已注册商家账号'));
    }

    // 乡镇商家必须能解析到一个有效的服务区域，否则不允许入库。
    let townArea = null;
    if (businessScope === 'town_food') {
      townArea = await resolveTownArea(townCode, transaction);
      if (!townArea) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('所选乡镇不存在或已停用'));
      }
    }

    // 先建账号，再建商家资料，两者放在同一个事务里提交。
    const user = await User.create({
      phone,
      password,
      nickname,
      role: 'merchant',
      status: 1
    }, { transaction });

    const merchant = await Merchant.create({
      user_id: user.id,
      binding_code: await createMerchantBindingCode(transaction),
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
        merchant_binding_code: merchant.binding_code,
        audit_status: merchant.audit_status,
        business_scope: merchant.business_scope,
        town_code: merchant.town_code,
        town_name: merchant.town_name,
        supermarket_delivery_permission: merchant.supermarket_delivery_permission
      }),
      merchant: {
        id: merchant.id,
        binding_code: merchant.binding_code,
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

/**
 * 骑手 / 商家自配送员注册
 * 这个入口会根据前端传参，分流成“普通骑手注册”或“商家自配送员注册”两条链路。
 */
exports.registerRider = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const registrationRole = resolveRiderRegistrationRole(req.body);
    const phone = normalizeText(req.body.phone);
    const password = req.body.password;
    const defaultNicknamePrefix = registrationRole === MERCHANT_DELIVERY_ROLE ? '配送员' : '骑手';
    const nickname = normalizeText(req.body.nickname) || `${defaultNicknamePrefix}${phone.slice(-4)}`;
    const deliveryScope = normalizeText(req.body.delivery_scope);
    const requestedRiderKind = normalizeText(req.body.rider_kind);
    const townCode = normalizeText(req.body.town_code);
    const bindingCode = normalizeMerchantBindingCode(
      req.body.merchant_binding_code ??
      req.body.binding_code ??
      req.body.store_binding_code ??
      req.body.store_id
    );

    if (!phone || !password) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    // 骑手注册前，也要先清掉历史驳回记录占用的手机号。
    await releaseRejectedRiderPhoneOccupation(phone, transaction);

    const existingUser = await findUserByPhoneAndRoles(phone, RIDER_ROLE_GROUP, transaction);
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('该手机号已注册骑手账号'));
    }

    // 商家自配送员必须绑定到一个真实存在的商家绑定码。
    if (registrationRole === MERCHANT_DELIVERY_ROLE) {
      if (!isValidMerchantBindingCode(bindingCode)) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('店铺绑定ID必须为6位数字'));
      }

      const merchant = await findBindableMerchantByCode(bindingCode, transaction);
      if (!merchant) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('无商家，请检查商家ID'));
      }

      // 自配送员只建用户账号，商家信息从绑定到的商家记录里读取。
      const user = await User.create({
        phone,
        password,
        nickname,
        role: MERCHANT_DELIVERY_ROLE,
        status: 0,
        rider_audit_status: 0,
        bound_merchant_id: merchant.id
      }, { transaction });

      await transaction.commit();

      const authPayload = buildAuthPayload(user, {
        delivery_domain: 'merchant_self_delivery',
        bound_merchant_id: merchant.id,
        merchant_binding_code: merchant.binding_code,
        merchant_name: merchant.name,
        merchant_address: merchant.address,
        business_scope: merchant.business_scope,
        town_code: merchant.town_code,
        town_name: merchant.town_name
      });
      authPayload.merchant = {
        id: merchant.id,
        binding_code: merchant.binding_code,
        name: merchant.name,
        address: merchant.address,
        business_scope: merchant.business_scope,
        town_code: merchant.town_code,
        town_name: merchant.town_name,
        status: merchant.status,
        audit_status: merchant.audit_status
      };

      return res.status(201).json(successResponse(authPayload, '商家自配送员工注册成功'));
    }

    // 普通骑手这条链路会额外校验配送业务线、乡镇归属和账号类型。
    if (!deliveryScope) {
      await transaction.rollback();
      return res.status(400).json(errorResponse('配送业务线不能为空'));
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

    let riderKind = 'rider';
    if (deliveryScope === 'town_delivery') {
      riderKind = requestedRiderKind || 'stationmaster';
      if (!['rider', 'stationmaster'].includes(riderKind)) {
        await transaction.rollback();
        return res.status(400).json(errorResponse('乡镇账号类型参数不正确'));
      }
    } else if (requestedRiderKind && requestedRiderKind !== 'rider') {
      await transaction.rollback();
      return res.status(400).json(errorResponse('县城骑手账号类型参数不正确'));
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
      rider_level: deliveryScope === 'town_delivery' && riderKind === 'stationmaster' ? 'captain' : 'normal',
      town_code: townArea ? townArea.area_code : null,
      town_name: townArea ? townArea.area_name : null,
      rider_kind: deliveryScope === 'town_delivery' ? riderKind : 'rider',
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
 * 解析商家绑定码
 * 商家自配送员注册页输入 6 位商家 ID 后，前端通常会先调这个接口确认商家是否存在。
 */
exports.resolveMerchantBinding = async (req, res, next) => {
  try {
    const bindingCode = normalizeMerchantBindingCode(
      req.body?.merchant_binding_code ??
      req.body?.binding_code ??
      req.body?.store_binding_code ??
      req.body?.store_id
    );

    if (!isValidMerchantBindingCode(bindingCode)) {
      return res.status(400).json(errorResponse('店铺绑定ID必须为6位数字'));
    }

    const merchant = await findBindableMerchantByCode(bindingCode);
    if (!merchant) {
      return res.status(404).json(errorResponse('无商家，请检查商家ID'));
    }

    res.json(successResponse({
      merchant_id: merchant.id,
      merchant_binding_code: merchant.binding_code,
      merchant_name: merchant.name,
      merchant_address: merchant.address,
      business_scope: merchant.business_scope,
      town_code: merchant.town_code,
      town_name: merchant.town_name
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 用户登录
 * 支持按登录场景限制角色范围，避免商家端拿普通用户账号登录，或者骑手端登录错账号。
 */
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const loginScene = normalizeLoginScene(req.body);
    const scopedRoles = resolveLoginRolesByScene(loginScene);

    // 先校验基础账号密码参数。
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    // 如果前端声明了登录场景，这里会把可登录角色范围先收窄。
    const user = scopedRoles.length
      ? await findUserByPhoneAndRoles(phone, scopedRoles)
      : await User.findOne({ where: { phone }, order: [['id', 'DESC']] });
    if (!user) {
      return res.status(400).json(errorResponse(getMissingAccountMessageByScene(loginScene)));
    }

    // 账号找到后，再校验密码。
    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(400).json(errorResponse('密码错误'));
    }

    // 只有启用状态的账号才允许登录。
    if (user.status !== 1) {
      return res.status(403).json(errorResponse('账号已被禁用'));
    }

    const accountExtra = user.role === 'merchant'
      ? await loadMerchantAuthExtra(user.id)
      : user.role === MERCHANT_DELIVERY_ROLE
        ? await loadMerchantDeliveryAuthExtra(user)
        : null;

    const authPayload = buildAuthPayload(user, accountExtra || {});
    if (accountExtra?.merchant) {
      authPayload.merchant = accountExtra.merchant;
    }

    res.json(successResponse(authPayload, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户信息
 * 这里返回的是“当前登录态下的完整用户资料”，包括商家扩展信息和手机号修改次数统计。
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    const accountExtra = user.role === 'merchant'
      ? await loadMerchantAuthExtra(user.id)
      : user.role === MERCHANT_DELIVERY_ROLE
        ? await loadMerchantDeliveryAuthExtra(user)
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
      bound_merchant_id: user.bound_merchant_id,
      rider_level: user.rider_level,
      town_code: user.town_code,
      town_name: user.town_name,
      ...(accountExtra ? {
        merchant_id: accountExtra.merchant_id,
        merchant_binding_code: accountExtra.merchant_binding_code,
        audit_status: accountExtra.audit_status,
        business_scope: accountExtra.business_scope,
        delivery_domain: accountExtra.delivery_domain,
        bound_merchant_id: accountExtra.bound_merchant_id ?? user.bound_merchant_id,
        merchant_name: accountExtra.merchant_name,
        merchant_address: accountExtra.merchant_address,
        town_code: accountExtra.town_code ?? user.town_code,
        town_name: accountExtra.town_name ?? user.town_name,
        supermarket_delivery_permission: accountExtra.supermarket_delivery_permission
      } : {})
    }, user.id);

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户信息
 * 当前这里只开放昵称和头像这类轻资料修改，不处理敏感账号字段。
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
 * 当前先采用“输入当前登录密码”做校验，后续如果上短信验证码，可以在这里升级。
 */
exports.changePhone = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const authUser = req.user;
    const newPhone = normalizePhone(req.body.new_phone ?? req.body.phone);
    const password = req.body.password;
    const year = getCurrentYear();

    // 换绑手机号是敏感操作，所以这里会在事务里锁住当前用户，防止并发修改。
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

    // 一年最多只允许修改固定次数，避免账号被频繁换绑。
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
