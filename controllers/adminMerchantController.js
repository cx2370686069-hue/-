const { Merchant, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

const formatMerchantSummary = (merchant) => ({
  id: merchant.id,
  user_id: merchant.user_id,
  store_name: merchant.name,
  merchant_nickname: merchant.user ? merchant.user.nickname : '',
  phone: merchant.phone || (merchant.user ? merchant.user.phone : ''),
  business_scope: merchant.business_scope,
  town_code: merchant.town_code,
  town_name: merchant.town_name,
  supermarket_delivery_permission: merchant.supermarket_delivery_permission,
  business_license: merchant.business_license,
  created_at: merchant.createdAt,
  audit_status: merchant.audit_status,
  status: merchant.status
});

const formatMerchantDetail = (merchant) => ({
  id: merchant.id,
  user_id: merchant.user_id,
  store_name: merchant.name,
  merchant_nickname: merchant.user ? merchant.user.nickname : '',
  phone: merchant.phone || (merchant.user ? merchant.user.phone : ''),
  user_phone: merchant.user ? merchant.user.phone : '',
  business_scope: merchant.business_scope,
  town_code: merchant.town_code,
  town_name: merchant.town_name,
  supermarket_delivery_permission: merchant.supermarket_delivery_permission,
  business_license: merchant.business_license,
  address: merchant.address,
  description: merchant.description,
  category: merchant.category,
  logo: merchant.logo,
  cover: merchant.cover,
  audit_status: merchant.audit_status,
  status: merchant.status,
  created_at: merchant.createdAt,
  user: merchant.user
    ? {
        id: merchant.user.id,
        nickname: merchant.user.nickname,
        phone: merchant.user.phone,
        avatar: merchant.user.avatar,
        role: merchant.user.role,
        status: merchant.user.status
      }
    : null
});

exports.getPendingMerchants = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const result = await Merchant.findAndCountAll({
      where: { audit_status: 0 },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'phone', 'avatar', 'role', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json(successResponse({
      list: result.rows.map(formatMerchantSummary),
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

exports.getMerchantAuditDetail = async (req, res, next) => {
  try {
    const merchant = await Merchant.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'phone', 'avatar', 'role', 'status']
        }
      ]
    });

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在', 404));
    }

    res.json(successResponse(formatMerchantDetail(merchant)));
  } catch (error) {
    next(error);
  }
};

exports.approveMerchant = async (req, res, next) => {
  try {
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在', 404));
    }

    merchant.audit_status = 1;
    await merchant.save();

    res.json(successResponse({
      id: merchant.id,
      audit_status: merchant.audit_status
    }, '审核通过'));
  } catch (error) {
    next(error);
  }
};

exports.rejectMerchant = async (req, res, next) => {
  try {
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在', 404));
    }

    merchant.audit_status = 2;
    await merchant.save();

    res.json(successResponse({
      id: merchant.id,
      audit_status: merchant.audit_status
    }, '审核已拒绝'));
  } catch (error) {
    next(error);
  }
};
