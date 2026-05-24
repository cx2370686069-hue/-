// 这个文件是“后台系统通知控制器”。
// 后台创建通知、编辑通知、发布、下线、置顶、删除，都是走这里。
const { Op } = require('sequelize');
const { SystemNotification } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  SYSTEM_NOTIFICATION_TARGET_ROLES,
  SYSTEM_NOTIFICATION_STATUSES
} = require('../models/SystemNotification');

// 文本统一先做去空格处理，避免后台表单带着空格入库。
const normalizeText = (value) => String(value || '').trim();

// 后台表单里的布尔值经常会混着 true / false / 1 / 0 / yes / no。
// 这里统一把它们收口成真正的布尔值，避免每个接口自己重复判断。
const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(text)) {
    return false;
  }
  return defaultValue;
};

// 这里把通知对象整理成后台前端稳定使用的返回结构。
const formatNotification = (item) => ({
  id: item.id,
  title: item.title,
  summary: item.summary || '',
  content: item.content,
  target_role: item.target_role,
  status: item.status,
  is_pinned: Boolean(item.is_pinned),
  published_at: item.published_at || null,
  created_at: item.created_at || null,
  updated_at: item.updated_at || null,
  created_by: item.created_by || null,
  updated_by: item.updated_by || null
});

// 创建和更新通知时，标题、正文、目标角色、状态都走这里统一校验。
const validateNotificationPayload = ({
  title,
  content,
  targetRole,
  status
}) => {
  if (!title) {
    return '通知标题不能为空';
  }
  if (title.length > 100) {
    return '通知标题不能超过100个字';
  }
  if (!content) {
    return '通知正文不能为空';
  }
  if (!SYSTEM_NOTIFICATION_TARGET_ROLES.includes(targetRole)) {
    return '目标角色参数不正确';
  }
  if (status && !SYSTEM_NOTIFICATION_STATUSES.includes(status)) {
    return '通知状态参数不正确';
  }
  return '';
};

/**
 * 后台通知列表
 * 支持按关键词、状态、目标角色筛选，并按置顶优先、发布时间倒序返回。
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const keyword = normalizeText(req.query.keyword);
    const status = normalizeText(req.query.status);
    const targetRole = normalizeText(req.query.target_role || req.query.targetRole);

    const where = {};
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { summary: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (status && SYSTEM_NOTIFICATION_STATUSES.includes(status)) {
      where.status = status;
    }
    if (targetRole && SYSTEM_NOTIFICATION_TARGET_ROLES.includes(targetRole)) {
      where.target_role = targetRole;
    }

    const items = await SystemNotification.findAll({
      where,
      order: [
        ['is_pinned', 'DESC'],
        ['published_at', 'DESC'],
        ['updated_at', 'DESC'],
        ['id', 'DESC']
      ]
    });

    res.json(successResponse(items.map(formatNotification)));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建系统通知
 * 如果创建时状态就是 published，这里会顺手把发布时间一起写进去。
 */
exports.createNotification = async (req, res, next) => {
  try {
    const title = normalizeText(req.body.title);
    const summary = normalizeText(req.body.summary);
    const content = normalizeText(req.body.content);
    const targetRole = normalizeText(req.body.target_role || req.body.targetRole || 'all');
    const status = normalizeText(req.body.status || 'draft') || 'draft';
    const isPinned = normalizeBoolean(req.body.is_pinned ?? req.body.isPinned, false);

    const validationError = validateNotificationPayload({
      title,
      content,
      targetRole,
      status
    });
    if (validationError) {
      return res.status(400).json(errorResponse(validationError));
    }

    const publishedAt = status === 'published' ? new Date() : null;
    const item = await SystemNotification.create({
      title,
      summary: summary || null,
      content,
      target_role: targetRole,
      status,
      is_pinned: isPinned,
      published_at: publishedAt,
      created_by: req.user.id,
      updated_by: req.user.id
    });

    res.status(201).json(successResponse(formatNotification(item), '通知创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新系统通知
 * 这里只改通知本身的内容和状态，不负责真正的前端推送。
 */
exports.updateNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('通知不存在'));
    }

    const title = normalizeText(req.body.title || item.title);
    const summary = normalizeText(req.body.summary ?? item.summary);
    const content = normalizeText(req.body.content || item.content);
    const targetRole = normalizeText(req.body.target_role || req.body.targetRole || item.target_role);
    const status = normalizeText(req.body.status || item.status) || item.status;
    const isPinned = req.body.is_pinned === undefined && req.body.isPinned === undefined
      ? Boolean(item.is_pinned)
      : normalizeBoolean(req.body.is_pinned ?? req.body.isPinned, Boolean(item.is_pinned));

    const validationError = validateNotificationPayload({
      title,
      content,
      targetRole,
      status
    });
    if (validationError) {
      return res.status(400).json(errorResponse(validationError));
    }

    const nextPublishedAt =
      status === 'published'
        ? (item.published_at || new Date())
        : status === 'offline'
          ? item.published_at
          : null;

    await item.update({
      title,
      summary: summary || null,
      content,
      target_role: targetRole,
      status,
      is_pinned: isPinned,
      published_at: nextPublishedAt,
      updated_by: req.user.id
    });

    res.json(successResponse(formatNotification(item), '通知更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 发布通知
 * 只有标题和正文都完整时，才允许从草稿切到已发布。
 */
exports.publishNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('通知不存在'));
    }

    if (!normalizeText(item.title) || !normalizeText(item.content)) {
      return res.status(400).json(errorResponse('通知标题和正文不能为空'));
    }

    await item.update({
      status: 'published',
      published_at: item.published_at || new Date(),
      updated_by: req.user.id
    });

    res.json(successResponse(formatNotification(item), '通知发布成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 下线通知
 * 下线后通知仍然保留在库里，只是状态变成 offline，不再对外展示。
 */
exports.offlineNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('通知不存在'));
    }

    await item.update({
      status: 'offline',
      updated_by: req.user.id
    });

    res.json(successResponse(formatNotification(item), '通知已下线'));
  } catch (error) {
    next(error);
  }
};

/**
 * 置顶 / 取消置顶通知
 * 这里只切换 is_pinned 状态，让后台列表和用户端列表可以优先展示重点通知。
 */
exports.pinNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('通知不存在'));
    }

    const isPinned = normalizeBoolean(req.body.is_pinned ?? req.body.isPinned, !item.is_pinned);

    await item.update({
      is_pinned: isPinned,
      updated_by: req.user.id
    });

    res.json(successResponse(formatNotification(item), isPinned ? '通知已置顶' : '通知已取消置顶'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除通知
 * 这里是真删数据，所以只有后台入口才应该调用这个接口。
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('通知不存在'));
    }

    await item.destroy();

    res.json(successResponse({ id }, '通知删除成功'));
  } catch (error) {
    next(error);
  }
};
