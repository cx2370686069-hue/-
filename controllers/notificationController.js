// 这个文件是“用户端系统通知控制器”。
// 用户端查看已发布通知、打开通知详情、统计未读数，都是走这里。
const { Op } = require('sequelize');
const { SystemNotification, SystemNotificationRead } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

// 用户端只能看到面向全体用户或普通用户的通知。
const USER_VISIBLE_TARGET_ROLES = ['all', 'user'];

// limit 这类参数统一按正整数解析。
const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

// 通知对象统一整理成前端可直接使用的结构。
const formatNotification = (item) => ({
  id: item.id,
  title: item.title,
  summary: item.summary || '',
  content: item.content,
  target_role: item.target_role,
  is_pinned: Boolean(item.is_pinned),
  published_at: item.published_at || null,
  created_at: item.created_at || null,
  updated_at: item.updated_at || null
});

// “已发布且当前用户可见”的查询条件统一在这里维护。
const buildPublishedNotificationWhere = (extraWhere = {}) => ({
  ...extraWhere,
  status: 'published',
  target_role: {
    [Op.in]: USER_VISIBLE_TARGET_ROLES
  }
});

// 用户打开通知详情时，会顺手把这条通知标记成已读。
const markNotificationAsRead = async (notificationId, userId) => {
  if (!notificationId || !userId) {
    return;
  }

  await SystemNotificationRead.findOrCreate({
    where: {
      notification_id: notificationId,
      user_id: userId
    },
    defaults: {
      read_at: new Date(),
      created_at: new Date()
    }
  });
};

/**
 * 获取已发布通知列表
 * 这里只返回用户端可见的已发布通知，不包含草稿和下线通知。
 */
exports.getPublishedNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(toPositiveInteger(req.query.limit, 20), 50);

    const items = await SystemNotification.findAll({
      where: buildPublishedNotificationWhere(),
      order: [
        ['is_pinned', 'DESC'],
        ['published_at', 'DESC'],
        ['id', 'DESC']
      ],
      limit
    });

    res.json(successResponse(items.map(formatNotification)));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取已发布通知详情
 * 用户打开通知详情页时，除了返回内容，还会顺手把通知记成已读。
 */
exports.getPublishedNotificationDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('通知ID不正确'));
    }

    const item = await SystemNotification.findOne({
      where: buildPublishedNotificationWhere({ id })
    });

    if (!item) {
      return res.status(404).json(errorResponse('通知不存在或暂未发布'));
    }

    await markNotificationAsRead(item.id, req.user.id);

    res.json(successResponse(formatNotification(item)));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取未读通知数量
 * 当前算法是：先取出所有已发布通知，再减去当前用户已经读过的数量。
 */
exports.getUnreadNotificationCount = async (req, res, next) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json(errorResponse('登录已失效', 401));
    }

    const publishedIds = await SystemNotification.findAll({
      where: buildPublishedNotificationWhere(),
      attributes: ['id'],
      raw: true
    });

    const notificationIds = publishedIds.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
    if (!notificationIds.length) {
      return res.json(successResponse({
        unread_count: 0,
        unreadCount: 0
      }));
    }

    const readCount = await SystemNotificationRead.count({
      where: {
        user_id: userId,
        notification_id: {
          [Op.in]: notificationIds
        }
      }
    });

    const unreadCount = Math.max(notificationIds.length - readCount, 0);

    res.json(successResponse({
      unread_count: unreadCount,
      unreadCount
    }));
  } catch (error) {
    next(error);
  }
};
