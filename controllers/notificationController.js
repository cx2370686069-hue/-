const { Op } = require('sequelize');
const { SystemNotification, SystemNotificationRead } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const USER_VISIBLE_TARGET_ROLES = ['all', 'user'];

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

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

const buildPublishedNotificationWhere = (extraWhere = {}) => ({
  ...extraWhere,
  status: 'published',
  target_role: {
    [Op.in]: USER_VISIBLE_TARGET_ROLES
  }
});

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
