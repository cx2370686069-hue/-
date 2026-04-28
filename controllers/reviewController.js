const { Review, Order, User, Merchant, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

const parseReviewImages = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const maskNickname = (nickname) => {
  const text = String(nickname || '').trim();
  if (!text) {
    return '匿名用户';
  }
  if (text.length === 1) {
    return `${text}*`;
  }
  return `${text.slice(0, 1)}***${text.slice(-1)}`;
};

const normalizeMerchantId = (value) => {
  const merchantId = Number.parseInt(value, 10);
  return Number.isInteger(merchantId) && merchantId > 0 ? merchantId : null;
};

const formatAverageRating = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Number(num.toFixed(1));
};

const buildProductSummary = (items) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) {
    return '';
  }

  const firstItem = list[0] || {};
  const firstName = String(
    firstItem.product_name ||
    firstItem.name ||
    firstItem.title ||
    ''
  ).trim();

  const totalCount = list.reduce((sum, item) => {
    const quantity = Number(item?.quantity ?? item?.count ?? item?.num ?? 1);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }, 0);

  if (!firstName) {
    return totalCount > 0 ? `共${totalCount}件商品` : '';
  }

  if (totalCount <= 1) {
    return firstName;
  }

  return `${firstName}等${totalCount}件`;
};

/**
 * 获取商家评价摘要（用户端公开）
 */
exports.getMerchantReviewSummary = async (req, res, next) => {
  try {
    const merchantId = normalizeMerchantId(req.query.merchant_id ?? req.params.id);
    if (!merchantId) {
      return res.status(400).json(errorResponse('缺少有效的 merchant_id'));
    }

    const [summaryRow, groupedRows] = await Promise.all([
      Review.findOne({
        where: {
          merchant_id: merchantId,
          status: { [Op.ne]: 0 }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('merchant_score')), 'rating'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'review_count']
        ],
        raw: true
      }),
      Review.findAll({
        where: {
          merchant_id: merchantId,
          status: { [Op.ne]: 0 }
        },
        attributes: [
          'merchant_score',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['merchant_score'],
        raw: true
      })
    ]);

    const scoreCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    groupedRows.forEach((row) => {
      const score = Number.parseInt(row.merchant_score, 10);
      const count = Number.parseInt(row.count, 10) || 0;
      if (scoreCounts[score] !== undefined) {
        scoreCounts[score] = count;
      }
    });

    const reviewCount = Number.parseInt(summaryRow?.review_count, 10) || 0;
    const rating = formatAverageRating(summaryRow?.rating);

    res.json(successResponse({
      merchant_id: merchantId,
      rating,
      review_count: reviewCount,
      score_5_count: scoreCounts[5],
      score_4_count: scoreCounts[4],
      score_3_count: scoreCounts[3],
      score_2_count: scoreCounts[2],
      score_1_count: scoreCounts[1]
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家公开评价列表（用户端公开）
 */
exports.getMerchantPublicReviews = async (req, res, next) => {
  try {
    const merchantId = normalizeMerchantId(req.query.merchant_id ?? req.params.id);
    if (!merchantId) {
      return res.status(400).json(errorResponse('缺少有效的 merchant_id'));
    }

    const pageNum = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const where = {
      merchant_id: merchantId,
      status: { [Op.ne]: 0 }
    };

    const ratingNum = Number.parseInt(req.query.rating, 10);
    if (Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
      where.merchant_score = ratingNum;
    }

    const { rows, count } = await Review.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['nickname', 'avatar']
      }, {
        model: Order,
        as: 'order',
        attributes: ['order_no', 'items_json']
      }],
      order: [['id', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    });

    const list = rows.map((review) => {
      const nickname = review.user?.nickname || '用户';
      const isAnonymous = Boolean(review.is_anonymous);
      return {
        id: review.id,
        order_id: review.order_id,
        order_no: review.order?.order_no || '',
        merchant_id: review.merchant_id,
        rating: review.merchant_score,
        merchant_score: review.merchant_score,
        merchant_content: review.merchant_content || '',
        merchant_images: parseReviewImages(review.merchant_images),
        merchant_reply: review.merchant_reply || '',
        merchant_replied_at: review.merchant_replied_at || null,
        rider_score: review.rider_score ?? null,
        rider_content: review.rider_content || '',
        is_anonymous: isAnonymous,
        created_at: review.created_at,
        user_nickname: isAnonymous ? maskNickname(nickname) : nickname,
        user_avatar: isAnonymous ? null : (review.user?.avatar || null),
        product_summary: buildProductSummary(review.order?.items_json)
      };
    });

    res.json(successResponse({
      list,
      total: count,
      page: pageNum,
      limit: limitNum
    }));
  } catch (error) {
    next(error);
  }
};

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

    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const where = {
      merchant_id: merchant.id,
      status: { [Op.ne]: 0 }
    };

    const ratingNum = Number.parseInt(rating, 10);
    if (Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
      where.merchant_score = ratingNum;
    }

    if (has_reply === '1') {
      where.merchant_reply = { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: '' }] };
    } else if (has_reply === '0') {
      where[Op.or] = [
        { merchant_reply: null },
        { merchant_reply: '' }
      ];
    }

    const { rows, count } = await Review.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['nickname', 'avatar']
      }, {
        model: Order,
        as: 'order',
        attributes: ['order_no']
      }],
      order: [['id', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    });

    const reviews = rows.map((review) => ({
      id: review.id,
      order_id: review.order_id,
      order_no: review.order?.order_no || '',
      user_id: review.user_id,
      user_name: review.is_anonymous ? maskNickname(review.user?.nickname) : (review.user?.nickname || '用户'),
      user_avatar: review.is_anonymous ? null : (review.user?.avatar || null),
      rating: review.merchant_score,
      content: review.merchant_content || '',
      images: parseReviewImages(review.merchant_images),
      reply: review.merchant_reply || '',
      reply_time: review.merchant_replied_at || null,
      rider_score: review.rider_score ?? null,
      rider_content: review.rider_content || '',
      create_time: review.created_at
    }));

    res.json(successResponse({
      list: reviews,
      total: count,
      page: pageNum,
      limit: limitNum
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
    const orderId = Number(req.params.order_id || req.body?.order_id || req.body?.orderId);
    const content = String(req.body?.content || '').trim();

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse('缺少有效的 order_id'));
    }
    if (!content) {
      return res.status(400).json(errorResponse('回复内容不能为空'));
    }

    const review = await Review.findOne({
      where: { order_id: orderId, merchant_id: merchant.id }
    });

    if (!review) {
      return res.status(404).json(errorResponse('评价不存在'));
    }

    const replyTime = new Date();
    await review.update({
      merchant_reply: content.slice(0, 500),
      merchant_replied_at: replyTime
    });

    res.json(successResponse({
      order_id: orderId,
      review_id: review.id,
      reply: content.slice(0, 500),
      reply_time: replyTime
    }, '回复成功'));
  } catch (error) {
    next(error);
  }
};
