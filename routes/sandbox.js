// 这个文件是“开发沙箱路由”。
// 它只给本地联调或测试环境使用，方便快速查商品、造订单，绝对不能挂到生产环境。
const express = require('express');
const router = express.Router();
const { Product, Order, Merchant } = require('../models');
const { successResponse, errorResponse, generateOrderNo } = require('../utils/helpers');

// 开发环境快速查看当前上架商品列表。
router.get('/products', async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { status: 1 }, // 真实互通：只返回上架商品
      order: [['id', 'DESC']]
    });
    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
});

// 开发环境快速创建测试订单。
router.post('/orders', async (req, res, next) => {
  try {
    const { product_id } = req.body;
    
    if (!product_id) {
      return res.status(400).json(errorResponse('缺少 product_id'));
    }

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    let merchant_id = product.merchant_id;
    if (!merchant_id) {
        const merchant = await Merchant.findOne();
        merchant_id = merchant ? merchant.id : 1;
    }

    const order_no = generateOrderNo();
    const items_json = JSON.stringify([product]);
    const order = await Order.create({
      order_no,
      order_id: order_no,
      user_id: 1, // 固定测试用户 ID，用于本地联调
      merchant_id: merchant_id,
      type: 'takeout',
      products_info: items_json,
      items_json,
      total_amount: product.price,
      pay_amount: product.price,
      total_price: Number(product.price),
      address: '测试地址',
      contact_phone: '13700137000',
      status: 0 // 待支付
    });

    res.status(201).json(successResponse(order, '订单创建成功'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
