// 这个文件是“乡镇站长审核骑手控制器”。
// 乡镇站长审核本乡镇骑手申请、查看列表和详情，主要都在这里。
const { Op } = require('sequelize');
const { User, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { isTownStationmaster } = require('../services/merchantAuditService');
const { releaseUserPhone } = require('../utils/rejectedApplicationPhone');

// 审核状态常量统一写在这里，避免到处散落魔法数字。
const AUDIT_STATUS_PENDING = 0;
const AUDIT_STATUS_APPROVED = 1;
const AUDIT_STATUS_REJECTED = 2;

// 短文本统一做去空格处理。
const safeText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

// 审核记录里用来展示“是谁审核的”。
const getAuditorDisplayName = (user = {}) => {
  return safeText(user.nickname || user.real_name || user.username || user.phone || user.name) || '站长';
};

// 列表分页参数统一收口。
const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(query.page_size ?? query.pageSize, 10) || 10, 1),
    50
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
};

// 站长筛选里的状态值统一在这里兼容。
const normalizeStatusFilter = (value, fallback = 'pending') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === 'pending') return 'pending';
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'all') return 'all';
  return '';
};

// 先确认当前登录人确实是乡镇站长。
const ensureStationmaster = (user, res) => {
  if (!isTownStationmaster(user)) {
    res.status(403).json(errorResponse('当前账号无审核权限', 403));
    return false;
  }

  return true;
};

// 站长只能审核自己负责乡镇里的骑手，这里统一拼乡镇范围条件。
const buildStationTownWhere = (stationUser = {}) => {
  const townCode = String(stationUser.town_code || '').trim();
  const townName = String(stationUser.town_name || stationUser.rider_town || '').trim();

  if (townCode) {
    return { town_code: townCode };
  }

  if (townName) {
    return {
      [Op.or]: [
        { town_name: townName },
        { rider_town: townName }
      ]
    };
  }

  return null;
};

// 骑手申请列表查询条件统一在这里构建。
const buildListWhere = ({ status = 'pending', stationUser } = {}) => {
  const townWhere = buildStationTownWhere(stationUser);
  if (!townWhere) {
    return null;
  }

  const where = {
    role: 'rider',
    delivery_scope: 'town_delivery',
    rider_kind: 'rider',
    ...townWhere
  };

  if (status === 'pending') {
    where.rider_audit_status = AUDIT_STATUS_PENDING;
  } else if (status === 'approved') {
    where.rider_audit_status = AUDIT_STATUS_APPROVED;
  } else if (status === 'rejected') {
    where.rider_audit_status = AUDIT_STATUS_REJECTED;
  }

  return where;
};

// 把审核状态数字转成前端可直接展示的文案。
const buildStatusText = (status) => {
  if (Number(status) === AUDIT_STATUS_APPROVED) return '已通过';
  if (Number(status) === AUDIT_STATUS_REJECTED) return '已驳回';
  return '待审核';
};

// 骑手申请返回结构统一在这里整理。
const buildRiderApplicationPayload = (rider, stationUser = null) => {
  const payload = {
    id: rider.id,
    user_id: rider.id,
    nickname: rider.nickname,
    phone: rider.phone,
    role: rider.role,
    delivery_scope: rider.delivery_scope,
    rider_level: rider.rider_level,
    town_code: rider.town_code,
    town_name: rider.town_name || rider.rider_town,
    rider_kind: rider.rider_kind,
    rider_town: rider.rider_town,
    rider_audit_status: rider.rider_audit_status,
    audited_by_role: rider.rider_audited_by_role,
    audited_by_user_id: rider.rider_audited_by_user_id,
    audited_by_name: rider.rider_audited_by_name,
    audited_at: rider.rider_audited_at,
    reject_reason: rider.rider_reject_reason,
    status: rider.status,
    created_at: rider.created_at || rider.createdAt,
    apply_status: Number(rider.rider_audit_status) === AUDIT_STATUS_APPROVED
      ? 'approved'
      : Number(rider.rider_audit_status) === AUDIT_STATUS_REJECTED
        ? 'rejected'
        : 'pending',
    apply_status_text: buildStatusText(rider.rider_audit_status),
    can_stationmaster_audit: Number(rider.rider_audit_status) === AUDIT_STATUS_PENDING
  };

  const stationTownWhere = stationUser ? buildStationTownWhere(stationUser) : null;
  if (stationTownWhere && stationTownWhere.town_code) {
    payload.can_stationmaster_audit = payload.can_stationmaster_audit && rider.town_code === stationTownWhere.town_code;
  }

  return payload;
};

// 给前端补当前乡镇审核汇总。
const buildSummary = async (stationUser) => {
  const baseWhere = buildListWhere({ status: 'all', stationUser });
  if (!baseWhere) {
    return {
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0
    };
  }

  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    User.count({ where: { ...baseWhere, rider_audit_status: AUDIT_STATUS_PENDING } }),
    User.count({ where: { ...baseWhere, rider_audit_status: AUDIT_STATUS_APPROVED } }),
    User.count({ where: { ...baseWhere, rider_audit_status: AUDIT_STATUS_REJECTED } })
  ]);

  return {
    pending_count: pendingCount,
    approved_count: approvedCount,
    rejected_count: rejectedCount
  };
};

// 查当前站长所在乡镇内的指定骑手申请。
const findStationTownRiderById = async (id, stationUser) => {
  const townWhere = buildStationTownWhere(stationUser);
  if (!townWhere) {
    return null;
  }

  return User.findOne({
    where: {
      id,
      role: 'rider',
      delivery_scope: 'town_delivery',
      rider_kind: 'rider',
      ...townWhere
    }
  });
};

/**
 * 获取乡镇骑手申请列表
 * 这里只会返回当前站长所属乡镇的乡镇骑手申请。
 */
exports.getRiderApplications = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const status = normalizeStatusFilter(req.query.status, 'pending');
    if (!status) {
      return res.status(400).json(errorResponse('status 参数不正确'));
    }

    const { page, pageSize, offset } = parsePagination(req.query);
    const where = buildListWhere({ status, stationUser: req.user });

    if (!where) {
      return res.json(successResponse({
        list: [],
        total: 0,
        page,
        page_size: pageSize,
        pending_count: 0,
        approved_count: 0,
        rejected_count: 0,
        summary: {
          pending_count: 0,
          approved_count: 0,
          rejected_count: 0
        }
      }));
    }

    const [result, summary] = await Promise.all([
      User.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset
      }),
      buildSummary(req.user)
    ]);

    res.json(successResponse({
      list: result.rows.map((rider) => buildRiderApplicationPayload(rider, req.user)),
      total: result.count,
      page,
      page_size: pageSize,
      pending_count: summary.pending_count,
      approved_count: summary.approved_count,
      rejected_count: summary.rejected_count,
      summary
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取乡镇骑手申请详情
 * 这里除了按 id 查，还会校验乡镇归属，避免站长看到别的乡镇申请。
 */
exports.getRiderApplicationDetail = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const rider = await findStationTownRiderById(req.params.id, req.user);
    if (!rider) {
      return res.status(404).json(errorResponse('骑手申请不存在', 404));
    }

    res.json(successResponse(buildRiderApplicationPayload(rider, req.user)));
  } catch (error) {
    next(error);
  }
};

/**
 * 审核通过乡镇骑手申请
 * 通过后会同步记录审核人、审核时间，并把骑手账号启用。
 */
exports.approveRiderApplication = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const rider = await findStationTownRiderById(req.params.id, req.user);
    if (!rider) {
      return res.status(404).json(errorResponse('骑手申请不存在', 404));
    }

    if (Number(rider.rider_audit_status) !== AUDIT_STATUS_PENDING) {
      return res.status(400).json(errorResponse('当前骑手不是待审核状态，不能重复审核'));
    }

    rider.rider_audit_status = AUDIT_STATUS_APPROVED;
    rider.status = 1;
    rider.rider_audited_by_role = 'stationmaster';
    rider.rider_audited_by_user_id = req.user?.id || null;
    rider.rider_audited_by_name = getAuditorDisplayName(req.user);
    rider.rider_audited_at = new Date();
    rider.rider_reject_reason = null;
    await rider.save();

    res.json(successResponse(
      buildRiderApplicationPayload(rider, req.user),
      '审核通过'
    ));
  } catch (error) {
    next(error);
  }
};

/**
 * 驳回乡镇骑手申请
 * 这里会在事务里同时写入驳回结果，并释放手机号占用，方便用户重新申请。
 */
exports.rejectRiderApplication = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const rider = await findStationTownRiderById(req.params.id, req.user);
    if (!rider) {
      return res.status(404).json(errorResponse('骑手申请不存在', 404));
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
        const error = new Error('骑手申请不存在');
        error.statusCode = 404;
        throw error;
      }

      lockedRider.rider_audit_status = AUDIT_STATUS_REJECTED;
      lockedRider.status = 0;
      lockedRider.rider_audited_by_role = 'stationmaster';
      lockedRider.rider_audited_by_user_id = req.user?.id || null;
      lockedRider.rider_audited_by_name = getAuditorDisplayName(req.user);
      lockedRider.rider_audited_at = new Date();
      lockedRider.rider_reject_reason = rejectReason;
      await lockedRider.save({ transaction });
      await releaseUserPhone(lockedRider, {
        scope: 'rider',
        transaction
      });

      return buildRiderApplicationPayload(lockedRider, req.user);
    });

    res.json(successResponse(
      payload,
      '审核已拒绝'
    ));
  } catch (error) {
    next(error);
  }
};
