// 这个文件是“商家审核服务”。
// 后台管理员审核商家、乡镇站长审核商家，都会复用这里的规则，避免多个入口各写一套审核逻辑。
const { Merchant, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { releaseMerchantUserPhoneByMerchant } = require('../utils/rejectedApplicationPhone');

// ==================== 审核状态与基础工具区 ====================
const AUDIT_STATUS_PENDING = 0;
const AUDIT_STATUS_APPROVED = 1;
const AUDIT_STATUS_REJECTED = 2;

const APPLY_STATUS_MAP = {
  [AUDIT_STATUS_PENDING]: 'pending',
  [AUDIT_STATUS_APPROVED]: 'approved',
  [AUDIT_STATUS_REJECTED]: 'rejected'
};

const APPLY_STATUS_TEXT_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
};

const trimText = (value) => String(value || '').trim();

const normalizeTownName = (value) => trimText(value);

// 判断当前申请是不是已经进入最终审核状态。
const isFinalAuditStatus = (auditStatus) => (
  Number(auditStatus) === AUDIT_STATUS_APPROVED || Number(auditStatus) === AUDIT_STATUS_REJECTED
);

const getApplyStatus = (auditStatus) => APPLY_STATUS_MAP[Number(auditStatus)] || 'pending';

const getApplyStatusText = (auditStatus) => APPLY_STATUS_TEXT_MAP[getApplyStatus(auditStatus)] || '待审核';

// 根据站长账号，拿到他负责的乡镇范围。
const getStationTownScope = (user) => ({
  town_code: trimText(user?.town_code),
  town_name: normalizeTownName(user?.town_name || user?.rider_town)
});

// 判断当前登录人是不是有乡镇审核权限的站长。
const isTownStationmaster = (user) => {
  const scope = getStationTownScope(user);

  return (
    user?.role === 'rider' &&
    user?.delivery_scope === 'town_delivery' &&
    (user?.rider_kind === 'stationmaster' || user?.rider_level === 'captain') &&
    (scope.town_code || scope.town_name)
  );
};

// 判断某个商家申请是否属于当前站长负责的乡镇。
const merchantBelongsToStationTown = (merchant, user) => {
  if (!merchant || merchant.business_scope !== 'town_food') {
    return false;
  }

  const scope = getStationTownScope(user);
  const merchantTownCode = trimText(merchant.town_code);
  const merchantTownName = normalizeTownName(merchant.town_name);

  if (scope.town_code && merchantTownCode) {
    return scope.town_code === merchantTownCode;
  }

  if (scope.town_name && merchantTownName) {
    return scope.town_name === merchantTownName;
  }

  return false;
};

const getAuditorDisplayName = (user) => (
  trimText(user?.nickname) ||
  trimText(user?.phone) ||
  (user?.id ? `用户${user.id}` : '')
);

// 审核状态已经锁死后，对前端返回一个更直白的原因提示。
const getAuditLockedReason = (merchant) => {
  if (!merchant || !isFinalAuditStatus(merchant.audit_status)) {
    return '';
  }

  if (merchant.audit_locked_reason) {
    return merchant.audit_locked_reason;
  }

  if (merchant.audited_by_role === 'stationmaster') {
    return '已由乡镇站长审批';
  }

  if (merchant.audited_by_role === 'admin') {
    return '已由总后台审批';
  }

  return '该申请已审核完成';
};

const isAuditLocked = (merchant) => (
  Boolean(merchant?.audit_locked) || isFinalAuditStatus(merchant?.audit_status)
);

const normalizeStatusFilter = (value, defaultValue = 'pending') => {
  const normalized = trimText(value).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (['pending', 'approved', 'rejected'].includes(normalized)) {
    return normalized;
  }

  return null;
};

const mapStatusFilterToAuditStatus = (status) => {
  if (status === 'approved') {
    return AUDIT_STATUS_APPROVED;
  }
  if (status === 'rejected') {
    return AUDIT_STATUS_REJECTED;
  }
  return AUDIT_STATUS_PENDING;
};

// 列表筛选条件统一构建，方便后台和站长两边共用同一套查询口径。
const buildListWhere = ({ status, stationUser } = {}) => {
  const where = {};

  if (status) {
    where.audit_status = mapStatusFilterToAuditStatus(status);
  }

  if (stationUser) {
    where.business_scope = 'town_food';
    const scope = getStationTownScope(stationUser);
    if (scope.town_code) {
      where.town_code = scope.town_code;
    } else if (scope.town_name) {
      where.town_name = scope.town_name;
    }
  }

  return where;
};

const buildSummaryWhere = ({ stationUser } = {}) => {
  const where = {};

  if (stationUser) {
    where.business_scope = 'town_food';
    const scope = getStationTownScope(stationUser);
    if (scope.town_code) {
      where.town_code = scope.town_code;
    } else if (scope.town_name) {
      where.town_name = scope.town_name;
    }
  }

  return where;
};

const canStationmasterAudit = (merchant, user) => (
  isTownStationmaster(user) &&
  merchantBelongsToStationTown(merchant, user) &&
  !isAuditLocked(merchant)
);

const canAdminAudit = (merchant, user) => (
  user?.role === 'admin' && !isAuditLocked(merchant)
);

// 这里把商家申请整理成前端可直接展示的结构。
const buildMerchantApplicationPayload = (merchant, currentUser) => {
  const contactName = trimText(merchant?.user?.nickname);
  const contactPhone = trimText(merchant?.phone || merchant?.user?.phone);
  const applyStatus = getApplyStatus(merchant?.audit_status);
  const auditLocked = isAuditLocked(merchant);
  const auditLockedReason = getAuditLockedReason(merchant);

  return {
    id: merchant.id,
    merchant_name: trimText(merchant.name),
    store_name: trimText(merchant.name),
    contact_name: contactName,
    merchant_nickname: contactName,
    contact_phone: contactPhone,
    phone: contactPhone,
    address: trimText(merchant.address),
    town_code: trimText(merchant.town_code),
    town_name: normalizeTownName(merchant.town_name),
    apply_status: applyStatus,
    apply_status_text: getApplyStatusText(merchant.audit_status),
    audit_status: Number(merchant.audit_status || 0),
    submitted_at: merchant.createdAt,
    created_at: merchant.createdAt,
    audited_at: merchant.audited_at || null,
    audited_by_role: trimText(merchant.audited_by_role) || null,
    audited_by_user_id: merchant.audited_by_user_id || null,
    audited_by_name: trimText(merchant.audited_by_name) || null,
    reject_reason: trimText(merchant.reject_reason) || null,
    can_stationmaster_audit: canStationmasterAudit(merchant, currentUser),
    can_admin_audit: canAdminAudit(merchant, currentUser),
    audit_locked: auditLocked,
    audit_locked_reason: auditLocked ? auditLockedReason : '',
    remark: trimText(merchant.description) || null,
    business_scope: trimText(merchant.business_scope) || null,
    business_license: trimText(merchant.business_license) || null,
    license_no: null,
    supermarket_delivery_permission: trimText(merchant.supermarket_delivery_permission) || null,
    status: Number(merchant.status || 0),
    user_id: merchant.user_id,
    user: merchant.user
      ? {
          id: merchant.user.id,
          nickname: trimText(merchant.user.nickname),
          phone: trimText(merchant.user.phone),
          avatar: merchant.user.avatar || null,
          role: merchant.user.role,
          status: merchant.user.status
        }
      : null
  };
};

// 审核详情联表配置统一放这里。
const getMerchantApplicationInclude = () => ([
  {
    model: User,
    as: 'user',
    attributes: ['id', 'nickname', 'phone', 'avatar', 'role', 'status']
  }
]);

const getAuditCompletedErrorMessage = (merchant) => {
  if (merchant?.audited_by_role === 'stationmaster') {
    return '已由乡镇站长审批';
  }

  if (merchant?.audited_by_role === 'admin') {
    return '已由总后台审批';
  }

  return '该申请已审核完成';
};

// 这是审核动作的真正执行入口。
// 无论是总后台审批还是乡镇站长审批，最终都走这个事务方法。
const auditMerchantApplication = async ({ merchantId, auditor, decision, rejectReason }) => {
  return sequelize.transaction(async (transaction) => {
    const merchant = await Merchant.findByPk(merchantId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!merchant) {
      const error = new Error('商家不存在');
      error.statusCode = 404;
      throw error;
    }

    if (decision === 'reject' && !trimText(rejectReason)) {
      const error = new Error('驳回原因不能为空');
      error.statusCode = 400;
      throw error;
    }

    if (isAuditLocked(merchant)) {
      const error = new Error(getAuditCompletedErrorMessage(merchant));
      error.statusCode = 400;
      throw error;
    }

    const auditRole = auditor.role === 'admin' ? 'admin' : 'stationmaster';

    if (auditRole === 'stationmaster') {
      if (!isTownStationmaster(auditor)) {
        const error = new Error('当前账号无审核权限');
        error.statusCode = 403;
        throw error;
      }

      if (!merchantBelongsToStationTown(merchant, auditor)) {
        const error = new Error('当前申请不属于你的乡镇');
        error.statusCode = 403;
        throw error;
      }
    } else if (auditor.role !== 'admin') {
      const error = new Error('当前账号无审核权限');
      error.statusCode = 403;
      throw error;
    }

    const lockedReason = auditRole === 'admin' ? '已由总后台审批' : '已由乡镇站长审批';

    await merchant.update({
      audit_status: decision === 'approve' ? AUDIT_STATUS_APPROVED : AUDIT_STATUS_REJECTED,
      audited_by_role: auditRole,
      audited_by_user_id: auditor.id,
      audited_by_name: getAuditorDisplayName(auditor),
      audited_at: new Date(),
      reject_reason: decision === 'reject' ? trimText(rejectReason) : null,
      audit_locked: true,
      audit_locked_reason: lockedReason
    }, { transaction });

    if (decision === 'reject') {
      await releaseMerchantUserPhoneByMerchant(merchant, transaction);
    }

    return Merchant.findByPk(merchant.id, {
      transaction,
      include: getMerchantApplicationInclude()
    });
  });
};

module.exports = {
  Op,
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
  getAuditCompletedErrorMessage,
  auditMerchantApplication
};
