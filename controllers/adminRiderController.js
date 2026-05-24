// 这个文件是“后台骑手审核控制器”。
// 后台审核普通骑手、商家自配送员，查看骑手列表和详情，也从这里走。
const { User, Merchant, Order, sequelize } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/helpers');
const { releaseUserPhone } = require('../utils/rejectedApplicationPhone');

// 这里统一维护骑手审核状态常量，避免下面写一堆魔法数字。
const AUDIT_STATUS_PENDING = 0;
const AUDIT_STATUS_APPROVED = 1;
const AUDIT_STATUS_REJECTED = 2;
const MERCHANT_DELIVERY_ROLE = 'merchant_delivery';

// 短文本统一做最基础的去空格处理。
const safeText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

// 统一判断这次审核人属于后台管理员还是站长。
const getAuditorRole = (user = {}) => (user.role === 'admin' ? 'admin' : 'stationmaster');

// 审核记录里要落“审核人名称”，这里统一拼出一个尽量稳定的展示名。
const getAuditorDisplayName = (user = {}) => {
  return safeText(user.nickname || user.real_name || user.username || user.phone || user.name) || '审核员';
};

// 骑手列表分页参数统一从这里收口。
const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

// 根据骑手的角色和配送域，推导后台展示时的人员身份文案。
const resolveIdentityType = (rider) => {
  if (rider.role === MERCHANT_DELIVERY_ROLE) {
    return '商家自配送员';
  }

  if (rider.delivery_scope === 'town_delivery' && rider.rider_kind === 'stationmaster') {
    return '乡镇站长';
  }

  if (rider.delivery_scope === 'town_delivery') {
    return '乡镇骑手';
  }

  if (rider.delivery_scope === 'county_delivery' || rider.rider_level === 'normal') {
    return '县城骑手';
  }

  return '县城骑手';
};

// 这里预留骑手认证材料的整理入口。
// 当前还没真正往外吐材料字段，但后面如果补身份证、健康证等展示，就从这里接。
const buildAuthMaterials = (rider) => {
  const materials = [];
  return materials;
};

// 骑手列表摘要结构统一在这里整理。
const formatRiderSummary = (rider) => ({
  id: rider.id,
  user_id: rider.id,
  nickname: rider.nickname,
  phone: rider.phone,
  role: rider.role,
  identity_type: resolveIdentityType(rider),
  delivery_scope: rider.delivery_scope,
  rider_level: rider.rider_level,
  town_code: rider.town_code,
  town_name: rider.town_name,
  rider_kind: rider.rider_kind,
  rider_town: rider.rider_town,
  rider_audit_status: rider.rider_audit_status,
  audit_status_text: Number(rider.rider_audit_status) === 1 ? '已通过' : Number(rider.rider_audit_status) === 2 ? '已拒绝' : '待审核',
  audited_by_role: rider.rider_audited_by_role,
  audited_by_user_id: rider.rider_audited_by_user_id,
  audited_by_name: rider.rider_audited_by_name,
  audited_at: rider.rider_audited_at,
  reject_reason: rider.rider_reject_reason,
  status: rider.status,
  created_at: rider.created_at || rider.createdAt,
  bound_merchant_id: rider.bound_merchant_id || null,
  merchant_name: rider.boundMerchant?.name || '',
  merchant_binding_code: rider.boundMerchant?.binding_code || ''
});

// 骑手详情结构统一在这里整理。
const formatRiderDetail = (rider) => ({
  id: rider.id,
  user_id: rider.id,
  nickname: rider.nickname,
  phone: rider.phone,
  avatar: rider.avatar,
  role: rider.role,
  identity_type: resolveIdentityType(rider),
  delivery_scope: rider.delivery_scope,
  rider_level: rider.rider_level,
  town_code: rider.town_code,
  town_name: rider.town_name,
  rider_kind: rider.rider_kind,
  rider_town: rider.rider_town,
  rider_status: rider.rider_status,
  rider_audit_status: rider.rider_audit_status,
  audit_status_text: Number(rider.rider_audit_status) === 1 ? '已通过' : Number(rider.rider_audit_status) === 2 ? '已拒绝' : '待审核',
  audited_by_role: rider.rider_audited_by_role,
  audited_by_user_id: rider.rider_audited_by_user_id,
  audited_by_name: rider.rider_audited_by_name,
  audited_at: rider.rider_audited_at,
  reject_reason: rider.rider_reject_reason,
  status: rider.status,
  created_at: rider.created_at || rider.createdAt,
  auth_materials: buildAuthMaterials(rider),
  bound_merchant_id: rider.bound_merchant_id || null,
  merchant: rider.boundMerchant ? {
    id: rider.boundMerchant.id,
    name: rider.boundMerchant.name,
    binding_code: rider.boundMerchant.binding_code
  } : null
});

// 按 id 查任意骑手或商家自配送员，并带上绑定商家信息。
const findRiderById = async (id) => User.findOne({
  where: {
    id,
    role: {
      [Op.in]: ['rider', MERCHANT_DELIVERY_ROLE]
    }
  },
  include: [
    {
      model: Merchant,
      as: 'boundMerchant',
      attributes: ['id', 'name', 'binding_code'],
      required: false
    }
  ]
});

// 按 id 查“仍可审核的待审骑手”。
const findPendingAuditableRiderById = async (id) => User.findOne({
  where: {
    id,
    role: {
      [Op.in]: ['rider', MERCHANT_DELIVERY_ROLE]
    }
  }
});

/**
 * 后台待审骑手列表
 * 这里只返回还没审核通过或驳回的骑手 / 商家自配送员。
 */
exports.getPendingRiders = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const result = await User.findAndCountAll({
      where: {
        role: {
          [Op.in]: ['rider', MERCHANT_DELIVERY_ROLE]
        },
        rider_audit_status: AUDIT_STATUS_PENDING
      },
      include: [
        {
          model: Merchant,
          as: 'boundMerchant',
          attributes: ['id', 'name', 'binding_code'],
          required: false
        }
      ],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
      offset
    });

    res.json(successResponse({
      list: result.rows.map(formatRiderSummary),
      pagination: {
        total: result.count,
        page,
        limit,
        total_pages: Math.ceil(result.count / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 后台骑手列表
 * 这里更偏“管理视角”，支持按角色和关键词筛选。
 */
exports.getRiderList = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const role = safeText(req.query.role) || MERCHANT_DELIVERY_ROLE;
    const keyword = safeText(req.query.keyword);

    const where = { role };
    if (keyword) {
      where[Op.or] = [
        { nickname: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
        { '$boundMerchant.name$': { [Op.like]: `%${keyword}%` } },
        { '$boundMerchant.binding_code$': { [Op.like]: `%${keyword}%` } }
      ];
    }

    const result = await User.findAndCountAll({
      where,
      include: [
        {
          model: Merchant,
          as: 'boundMerchant',
          attributes: ['id', 'name', 'binding_code'],
          required: false
        }
      ],
      subQuery: false,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
      offset
    });

    res.json(successResponse({
      list: result.rows.map(formatRiderSummary),
      pagination: {
        total: result.count,
        page,
        limit,
        total_pages: Math.ceil(result.count / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 后台骑手审核详情
 * 打开单个待审骑手详情时，通常走这个接口。
 */
exports.getRiderAuditDetail = async (req, res, next) => {
  try {
    const rider = await findPendingAuditableRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    res.json(successResponse(formatRiderDetail(rider)));
  } catch (error) {
    next(error);
  }
};

/**
 * 审核通过骑手
 * 通过后会同时把骑手状态打开，并记录审核人和审核时间。
 */
exports.approveRider = async (req, res, next) => {
  try {
    const rider = await findPendingAuditableRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    if (Number(rider.rider_audit_status) !== AUDIT_STATUS_PENDING) {
      return res.status(400).json(errorResponse('当前骑手不是待审核状态，不能重复审核'));
    }

    rider.rider_audit_status = AUDIT_STATUS_APPROVED;
    rider.status = 1;
    rider.rider_audited_by_role = getAuditorRole(req.user);
    rider.rider_audited_by_user_id = req.user?.id || null;
    rider.rider_audited_by_name = getAuditorDisplayName(req.user);
    rider.rider_audited_at = new Date();
    rider.rider_reject_reason = null;
    await rider.save();

    res.json(successResponse({
      id: rider.id,
      rider_audit_status: rider.rider_audit_status,
      status: rider.status
    }, '审核通过'));
  } catch (error) {
    next(error);
  }
};

/**
 * 驳回骑手申请
 * 这里会在事务里同时做两件事：写入驳回结果、释放手机号占用。
 */
exports.rejectRider = async (req, res, next) => {
  try {
    const rider = await findRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    if (Number(rider.rider_audit_status) !== AUDIT_STATUS_PENDING) {
      return res.status(400).json(errorResponse('当前骑手不是待审核状态，不能重复审核'));
    }

    const rejectReason = safeText(req.body?.reject_reason ?? req.body?.rejectReason ?? req.body?.reason);
    if (!rejectReason) {
      return res.status(400).json(errorResponse('驳回原因不能为空'));
    }

    const payload = await sequelize.transaction(async (transaction) => {
      const lockedRider = await User.findByPk(rider.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedRider) {
        const error = new Error('骑手不存在');
        error.statusCode = 404;
        throw error;
      }

      lockedRider.rider_audit_status = AUDIT_STATUS_REJECTED;
      lockedRider.status = 0;
      lockedRider.rider_audited_by_role = getAuditorRole(req.user);
      lockedRider.rider_audited_by_user_id = req.user?.id || null;
      lockedRider.rider_audited_by_name = getAuditorDisplayName(req.user);
      lockedRider.rider_audited_at = new Date();
      lockedRider.rider_reject_reason = rejectReason;
      await lockedRider.save({ transaction });
      await releaseUserPhone(lockedRider, {
        scope: 'rider',
        transaction
      });

      return {
        id: lockedRider.id,
        rider_audit_status: lockedRider.rider_audit_status,
        status: lockedRider.status
      };
    });

    res.json(successResponse(payload, '审核已拒绝'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除商家自配送员
 * 这里只允许删 merchant_delivery(商家自配送员)，并且会先检查是否还有配送中的订单。
 */
exports.deleteMerchantDeliveryRider = async (req, res, next) => {
  try {
    const rider = await User.findOne({
      where: {
        id: req.params.id,
        role: MERCHANT_DELIVERY_ROLE
      },
      include: [
        {
          model: Merchant,
          as: 'boundMerchant',
          attributes: ['id', 'name', 'binding_code'],
          required: false
        }
      ]
    });

    if (!rider) {
      return res.status(404).json(errorResponse('商家自配送员不存在', 404));
    }

    const activeOrder = await Order.findOne({
      where: {
        rider_id: rider.id,
        status: { [Op.in]: [5] }
      },
      attributes: ['id', 'order_no']
    });

    if (activeOrder) {
      return res.status(400).json(errorResponse(`该自配送员仍有配送中订单：${activeOrder.order_no}`));
    }

    const payload = {
      id: rider.id,
      nickname: rider.nickname,
      phone: rider.phone,
      bound_merchant_id: rider.bound_merchant_id || null,
      merchant_name: rider.boundMerchant?.name || '',
      merchant_binding_code: rider.boundMerchant?.binding_code || ''
    };

    await rider.destroy();

    res.json(successResponse(payload, '删除成功'));
  } catch (error) {
    next(error);
  }
};
