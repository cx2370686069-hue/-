const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { Order } = require('../models');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { successResponse, generateOrderNo } = require('../utils/helpers');

router.post('/test-create', async (req, res, next) => {
  try {
    const order_no = generateOrderNo();
    const items_json = JSON.stringify([]);
    const order = await Order.create({
      order_no,
      order_id: order_no,
      user_id: 3,
      merchant_id: 1,
      type: 'takeout',
      order_type: 'county',
      status: 4,
      products_info: items_json,
      items_json,
      total_amount: 1.0,
      pay_amount: 1.0,
      total_price: 1.0,
      address: '固始县测试地址',
      contact_phone: '13700137000',
      merchant_lng: 115.68233,
      merchant_lat: 32.18021,
      customer_lng: 115.65,
      customer_lat: 32.15
    });

    res.status(201).json(successResponse(order, '测试订单创建成功'));
  } catch (error) {
    next(error);
  }
});

// 需要登录的路由
router.post('/create', authMiddleware, orderController.createOrder);
router.post('/pay', authMiddleware, orderController.payOrder);
router.post('/cancel', authMiddleware, orderController.cancelOrder);
router.get('/my', authMiddleware, orderController.getUserOrders);
router.get('/detail/:id', authMiddleware, orderController.getOrderDetail);

// 商家端
router.get('/merchant/list', authMiddleware, roleMiddleware('merchant'), require('../controllers/merchantController').getMerchantOrders);
router.post('/accept', authMiddleware, roleMiddleware('merchant'), orderController.acceptOrder);
router.post('/reject', authMiddleware, roleMiddleware('merchant'), orderController.rejectOrder);
router.post('/prepare', authMiddleware, roleMiddleware('merchant'), orderController.prepareOrder);
router.post('/deliver', authMiddleware, roleMiddleware('merchant'), orderController.deliverOrder);

// 骑手端
router.post('/confirm-delivery', authMiddleware, roleMiddleware('rider'), orderController.confirmDelivery);
router.post('/rider-status', authMiddleware, roleMiddleware('rider'), orderController.updateRiderStatus);
router.get('/available', authMiddleware, roleMiddleware('rider'), orderController.getAvailableOrders);
router.get('/rider-orders', authMiddleware, roleMiddleware('rider'), orderController.getRiderOrders);

// 跑腿订单
router.post('/errand/publish', authMiddleware, orderController.publishErrand);
router.get('/errand/list', authMiddleware, orderController.getErrandList);
router.post('/errand/accept', authMiddleware, roleMiddleware('rider'), orderController.acceptErrand);
router.post('/errand/complete', authMiddleware, roleMiddleware('rider'), orderController.completeErrand);

module.exports = router;
