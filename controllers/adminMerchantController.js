// 这个文件是“后台商家审核控制器”。
// 后台查看商家申请、查看详情、审核通过、审核驳回，都是从这里进。
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
  auditMerchantApplication
} = require('../services/merchantAuditService');

// 统一解析分页参数。
// 后台列表很多地方都会用 page / page_size / limit 这些写法，所以这里先收口成一套标准格式。
const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(query.page_size ?? query.pageSize ?? query.limit, 10) || 10, 1),
    50
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
};

// 这里给后台列表补一份审核状态汇总。
// 这样前端在切换列表时，不用再单独调一个统计接口。
const buildSummary = async (baseWhere = {}) => {
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
 * 后台商家审核列表
 * 支持按审核状态分页查询，同时返回待审/通过/驳回三种状态的汇总数量。
 */
exports.getPendingMerchants = async (req, res, next) => {
  try {
    const status = normalizeStatusFilter(req.query.status, 'pending');
    if (!status) {
      return res.status(400).json(errorResponse('status 参数不正确'));
    }

    const { page, pageSize, offset } = parsePagination(req.query);
    const where = buildListWhere({ status });
    const summaryWhere = buildSummaryWhere();

    const [result, summary] = await Promise.all([
      Merchant.findAndCountAll({
        where,
        include: getMerchantApplicationInclude(),
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: pageSize,
        offset
      }),
      buildSummary(summaryWhere)
    ]);

    res.json(successResponse({
      list: result.rows.map((merchant) => buildMerchantApplicationPayload(merchant, req.user)),
      total: result.count,
      page,
      page_size: pageSize,
      pagination: {
        total: result.count,
        page,
        limit: pageSize,
        total_pages: Math.ceil(result.count / pageSize)
      },
      summary
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 后台商家审核详情
 * 打开某一条商家申请详情时，通常会走这里。
 */
exports.getMerchantAuditDetail = async (req, res, next) => {
  try {
    const merchant = await Merchant.findByPk(req.params.id, {
      include: getMerchantApplicationInclude()
    });

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在', 404));
    }

    res.json(successResponse(buildMerchantApplicationPayload(merchant, req.user)));
  } catch (error) {
    next(error);
  }
};

/**
 * 审核通过商家申请
 * 真正的审核规则不写在这个控制器里，而是下沉到 merchantAuditService(商家审核服务) 统一处理。
 */
exports.approveMerchant = async (req, res, next) => {
  try {
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
 * 驳回商家申请
 * 同样复用 merchantAuditService(商家审核服务)，避免后台和其他审核入口出现规则不一致。
 */
exports.rejectMerchant = async (req, res, next) => {
  try {
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
