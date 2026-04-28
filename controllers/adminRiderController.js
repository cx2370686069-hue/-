const { User } = require('../models');
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

const resolveIdentityType = (rider) => {
  if (rider.delivery_scope === 'town_delivery' || rider.rider_level === 'captain') {
    return '乡镇站长';
  }

  if (rider.delivery_scope === 'county_delivery' || rider.rider_level === 'normal') {
    return '县城骑手';
  }

  if (rider.rider_kind === 'stationmaster' || rider.rider_town) {
    return '乡镇站长';
  }

  return '县城骑手';
};

const buildAuthMaterials = (rider) => {
  const materials = [];
  return materials;
};

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
  status: rider.status,
  created_at: rider.created_at || rider.createdAt
});

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
  status: rider.status,
  created_at: rider.created_at || rider.createdAt,
  auth_materials: buildAuthMaterials(rider)
});

const findRiderById = async (id) => User.findOne({
  where: {
    id,
    role: 'rider'
  }
});

exports.getPendingRiders = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const result = await User.findAndCountAll({
      where: {
        role: 'rider',
        rider_audit_status: 0
      },
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

exports.getRiderAuditDetail = async (req, res, next) => {
  try {
    const rider = await findRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    res.json(successResponse(formatRiderDetail(rider)));
  } catch (error) {
    next(error);
  }
};

exports.approveRider = async (req, res, next) => {
  try {
    const rider = await findRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    if (Number(rider.rider_audit_status) !== 0) {
      return res.status(400).json(errorResponse('当前骑手不是待审核状态，不能重复审核'));
    }

    rider.rider_audit_status = 1;
    rider.status = 1;
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

exports.rejectRider = async (req, res, next) => {
  try {
    const rider = await findRiderById(req.params.id);

    if (!rider) {
      return res.status(404).json(errorResponse('骑手不存在', 404));
    }

    if (Number(rider.rider_audit_status) !== 0) {
      return res.status(400).json(errorResponse('当前骑手不是待审核状态，不能重复审核'));
    }

    rider.rider_audit_status = 2;
    rider.status = 0;
    await rider.save();

    res.json(successResponse({
      id: rider.id,
      rider_audit_status: rider.rider_audit_status,
      status: rider.status
    }, '审核已拒绝'));
  } catch (error) {
    next(error);
  }
};
