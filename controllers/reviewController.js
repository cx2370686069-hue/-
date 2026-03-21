const { Order, User, Merchant } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

/**
 * 获取评价列表（商家端）
 */
exports.getReviews = async (req, res, next) => {
  try {
    const user = req.user;
    const { page = 1, limit = 20, rating, has_reply } = req.query;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 获取该商家的所有订单
    const orders = await Order.findAll({
      where: {
        merchant_id: merchant.id,
        rating: { [Op.ne]: null } // 有评价的订单
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['nickname', 'avatar']
      }],
      order: [['id', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // 转换为评价列表格式
    const reviews = orders.map(order => ({
      id: order.id,
      order_no: order.order_no,
      user_id: order.user_id,
      user_name: order.user?.nickname || '匿名用户',
      user_avatar: order.user?.avatar,
      rating: order.rating,
      content: order.rating_content,
      images: order.rating_images ? JSON.parse(order.rating_images) : [],
      reply: order.merchant_reply,
      reply_time: order.merchant_reply_time,
      create_time: order.created_at
    }));

    const total = await Order.count({
      where: {
        merchant_id: merchant.id,
        rating: { [Op.ne]: null }
      }
    });

    res.json(successResponse({
      list: reviews,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 回复评价
 */
exports.replyReview = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, content } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (!order.rating) {
      return res.status(400).json(errorResponse('该订单没有评价'));
    }

    // 更新商家回复
    await order.update({
      merchant_reply: content,
      merchant_reply_time: new Date()
    });

    res.json(successResponse({
      order_id,
      reply: content,
      reply_time: new Date()
    }, '回复成功'));
  } catch (error) {
    next(error);
  }
};
