const { Op } = require('sequelize');
const { UserFeedback, User } = require('../models');
const { errorResponse, successResponse } = require('../utils/helpers');
const { USER_FEEDBACK_STATUSES } = require('../models/UserFeedback');

const normalizeText = (value) => String(value || '').trim();

const formatFeedback = (item) => ({
  id: item.id,
  user_id: item.user_id,
  submitter_name: normalizeText(item.user?.nickname) || `用户${item.user_id}`,
  submitter_phone: item.user?.phone || '',
  contact_phone: item.contact_phone,
  content: item.content,
  status: item.status,
  handled_by: item.handled_by || null,
  handled_at: item.handled_at || null,
  created_at: item.created_at || null,
  updated_at: item.updated_at || null
});

exports.getFeedbackList = async (req, res, next) => {
  try {
    const status = normalizeText(req.query.status);
    const keyword = normalizeText(req.query.keyword);

    const where = {};
    if (status && USER_FEEDBACK_STATUSES.includes(status)) {
      where.status = status;
    }
    if (keyword) {
      where[Op.or] = [
        { content: { [Op.like]: `%${keyword}%` } },
        { contact_phone: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const items = await UserFeedback.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'phone']
        }
      ],
      order: [['created_at', 'DESC'], ['id', 'DESC']]
    });

    res.json(successResponse(items.map(formatFeedback)));
  } catch (error) {
    next(error);
  }
};

exports.getFeedbackDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('投诉建议ID不正确'));
    }

    const item = await UserFeedback.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'phone']
        }
      ]
    });

    if (!item) {
      return res.status(404).json(errorResponse('投诉建议不存在'));
    }

    res.json(successResponse(formatFeedback(item)));
  } catch (error) {
    next(error);
  }
};

exports.updateFeedbackStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(errorResponse('投诉建议ID不正确'));
    }

    const status = normalizeText(req.body.status);
    if (!USER_FEEDBACK_STATUSES.includes(status)) {
      return res.status(400).json(errorResponse('处理状态参数不正确'));
    }

    const item = await UserFeedback.findByPk(id);
    if (!item) {
      return res.status(404).json(errorResponse('投诉建议不存在'));
    }

    await item.update({
      status,
      handled_by: req.user.id,
      handled_at: new Date()
    });

    const refreshedItem = await UserFeedback.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nickname', 'phone']
        }
      ]
    });

    res.json(successResponse(formatFeedback(refreshedItem), '投诉建议状态更新成功'));
  } catch (error) {
    next(error);
  }
};
