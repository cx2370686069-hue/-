const { UserFeedback } = require('../models');
const { errorResponse, successResponse } = require('../utils/helpers');

const normalizeText = (value) => String(value || '').trim();

exports.createFeedback = async (req, res, next) => {
  try {
    const content = normalizeText(req.body.content);
    const contactPhone = normalizeText(req.body.contact_phone || req.body.contactPhone);

    if (!content) {
      return res.status(400).json(errorResponse('投诉建议内容不能为空'));
    }
    if (content.length > 2000) {
      return res.status(400).json(errorResponse('投诉建议内容不能超过2000字'));
    }
    if (!contactPhone) {
      return res.status(400).json(errorResponse('联系电话不能为空'));
    }
    if (contactPhone.length > 20) {
      return res.status(400).json(errorResponse('联系电话格式不正确'));
    }

    const item = await UserFeedback.create({
      user_id: req.user.id,
      content,
      contact_phone: contactPhone,
      status: 'pending'
    });

    res.status(201).json(successResponse({
      id: item.id,
      status: item.status,
      created_at: item.created_at
    }, '投诉建议提交成功'));
  } catch (error) {
    next(error);
  }
};
