// 这个文件是“乡镇站长审核商家控制器”。
// 乡镇站长查看本乡镇商家申请、查看详情、审核通过、驳回，都是走这里。
const { Merchant } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  AUDIT_STATUS_PENDING,
  AUDIT_STATUS_APPROVED,
  AUDIT_STATUS_REJECTED,
  normalizeStatusFilter,
  buildListWhere,
  buildSummaryWhere,
  getMerchantApplicationInclude,
  buildMerchantApplicationPayload,
  isTownStationmaster,
  merchantBelongsToStationTown,
  auditMerchantApplication
} = require('../services/merchantAuditService');

// 乡镇站长审核列表分页统一走这里。
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

// 先确认当前登录人是不是有审核权限的乡镇站长。
const ensureStationmaster = (user, res) => {
  if (!isTownStationmaster(user)) {
    res.status(403).json(errorResponse('当前账号无审核权限', 403));
    return false;
  }

  return true;
};

// 给前端补一份当前乡镇的审核状态汇总。
const buildSummary = async (stationUser) => {
  const baseWhere = buildSummaryWhere({ stationUser });
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    Merchant.count({ where: { ...baseWhere, audit_status: AUDIT_STATUS_PENDING } }),
    Merchant.count({ where: { ...baseWhere, audit_status: AUDIT_STATUS_APPROVED } }),
    Merchant.count({ where: { ...baseWhere, audit_status: AUDIT_STATUS_REJECTED } })
  ]);

  return {
    pending_count: pendingCount,
    approved_count: approvedCount,
    rejected_count: rejectedCount
  };
};

/**
 * 获取乡镇商家申请列表
 * 这里只返回“当前站长自己所属乡镇”的商家申请。
 */
exports.getMerchantApplications = async (req, res, next) => {
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

    const [result, summary] = await Promise.all([
      Merchant.findAndCountAll({
        where,
        include: getMerchantApplicationInclude(),
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset
      }),
      buildSummary(req.user)
    ]);

    res.json(successResponse({
      list: result.rows.map((merchant) => buildMerchantApplicationPayload(merchant, req.user)),
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
 * 获取乡镇商家申请详情
 * 除了查 id，还会再次校验这条申请是否属于当前站长所在乡镇。
 */
exports.getMerchantApplicationDetail = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const merchant = await Merchant.findByPk(req.params.id, {
      include: getMerchantApplicationInclude()
    });

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在', 404));
    }

    if (!merchantBelongsToStationTown(merchant, req.user)) {
      return res.status(403).json(errorResponse('当前申请不属于你的乡镇', 403));
    }

    res.json(successResponse(buildMerchantApplicationPayload(merchant, req.user)));
  } catch (error) {
    next(error);
  }
};

/**
 * 审核通过乡镇商家申请
 * 具体审核规则已经下沉到 merchantAuditService(商家审核服务)，这里主要负责权限门禁和入口转发。
 */
exports.approveMerchantApplication = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const merchant = await auditMerchantApplication({
      merchantId: req.params.id,
      auditor: req.user,
      decision: 'approve'
    });

    res.json(successResponse(
      buildMerchantApplicationPayload(merchant, req.user),
      '审核通过'
    ));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
    }
    next(error);
  }
};

/**
 * 驳回乡镇商家申请
 * 同样复用 merchantAuditService(商家审核服务)，避免后台和站长审核规则不一致。
 */
exports.rejectMerchantApplication = async (req, res, next) => {
  try {
    if (!ensureStationmaster(req.user, res)) {
      return;
    }

    const merchant = await auditMerchantApplication({
      merchantId: req.params.id,
      auditor: req.user,
      decision: 'reject',
      rejectReason: req.body.reject_reason ?? req.body.rejectReason ?? req.body.reason
    });

    res.json(successResponse(
      buildMerchantApplicationPayload(merchant, req.user),
      '审核已拒绝'
    ));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.statusCode));
    }
    next(error);
  }
};
