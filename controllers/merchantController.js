const { Merchant, Product, ProductCategory, Order } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

/**
 * 获取商家列表
 */
exports.getMerchantList = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status = 1 } = req.query;
    
    const merchants = await Merchant.findAll({
      where: { status, audit_status: 1 },
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone', 'avatar']
      }],
      order: [['id', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    const total = await Merchant.count({ where: { status, audit_status: 1 } });

    res.json(successResponse({
      list: merchants,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家详情
 */
exports.getMerchantDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const merchant = await Merchant.findOne({
      where: { id },
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone', 'avatar']
      }]
    });

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    res.json(successResponse(merchant));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家商品分类
 */
exports.getCategories = async (req, res, next) => {
  try {
    const { merchant_id } = req.query;
    
    const categories = await ProductCategory.findAll({
      where: { merchant_id },
      order: [['sort', 'ASC'], ['id', 'DESC']]
    });

    res.json(successResponse(categories));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家商品列表
 */
exports.getProducts = async (req, res, next) => {
  try {
    const { merchant_id, category_id, status = 1 } = req.query;
    
    const where = { merchant_id, status };
    if (category_id) where.category_id = category_id;

    const products = await Product.findAll({
      where,
      order: [['sort', 'DESC'], ['id', 'DESC']]
    });

    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商家（商家端）
 */
exports.createMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    
    // 检查是否已经是商家
    const existingMerchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (existingMerchant) {
      return res.status(400).json(errorResponse('您已经拥有店铺'));
    }

    const merchant = await Merchant.create({
      user_id: user.id,
      ...req.body,
      audit_status: 0 // 待审核
    });

    res.status(201).json(successResponse(merchant, '店铺创建成功，请等待审核'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的店铺（商家端）
 */
exports.getMyMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    res.json(successResponse(merchant));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新店铺信息（商家端）
 */
exports.updateMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    await merchant.update(req.body);

    res.json(successResponse(merchant, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商品分类（商家端）
 */
exports.createCategory = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const category = await ProductCategory.create({
      merchant_id: merchant.id,
      ...req.body
    });

    res.status(201).json(successResponse(category, '分类创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商品（商家端）
 */
exports.createProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.create({
      merchant_id: merchant.id,
      ...req.body
    });

    res.status(201).json(successResponse(product, '商品创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品（商家端）
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    await product.update(req.body);

    res.json(successResponse(product, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取店铺订单（商家端）
 */
exports.getMerchantOrders = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status } = req.query;
    const where = { merchant_id: merchant.id };
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }, {
        model: require('../models').User,
        as: 'rider',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除商品（商家端）
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    await product.destroy();

    res.json(successResponse(null, '商品已删除'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品状态（上下架）
 */
exports.updateProductStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    const { status } = req.body;
    await product.update({ status: status ? 1 : 0 });

    res.json(successResponse(product, status ? '已上架' : '已下架'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商品详情（公开）
 */
exports.getProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({
      where: { id },
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['id', 'name', 'logo', 'phone', 'address']
      }]
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    res.json(successResponse(product));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的商品列表（商家端）
 */
exports.getMyProducts = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status, category_id } = req.query;
    const where = { merchant_id: merchant.id };
    if (status !== undefined) where.status = status;
    if (category_id) where.category_id = category_id;

    // 为了兼容，我们这里使用 left outer join，不强制要求商品必须有分类
    const products = await Product.findAll({
      where,
      include: [{
        model: ProductCategory,
        as: 'category',
        attributes: ['id', 'name'],
        required: false // 允许商品没有分类
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(products));
  } catch (error) {
    console.error('获取商家商品列表失败:', error);
    next(error);
  }
};

/**
 * 更新店铺营业状态
 */
exports.updateMerchantStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status } = req.body;
    await merchant.update({ status: status ? 1 : 0 });

    res.json(successResponse(merchant, status ? '已营业' : '已休息'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取店铺统计数据
 */
exports.getMerchantStats = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 今日订单
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: { [Op.gte]: today }
      }
    });

    // 今日销售额
    const todaySales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: { [Op.ne]: 7 }, // 排除已取消
        created_at: { [Op.gte]: today }
      }
    }) || 0;

    // 总订单数
    const totalOrders = await Order.count({
      where: { merchant_id: merchant.id }
    });

    // 总销售额
    const totalSales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: { [Op.ne]: 7 }
      }
    }) || 0;

    // 商品数量
    const productCount = await Product.count({
      where: { merchant_id: merchant.id }
    });

    res.json(successResponse({
      todayOrders,
      todaySales: parseFloat(todaySales).toFixed(2),
      totalOrders,
      totalSales: parseFloat(totalSales).toFixed(2),
      productCount
    }));
  } catch (error) {
    next(error);
  }
};
