const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 需要登录的路由
router.post('/create', authMiddleware, orderController.createOrder);
router.post('/pay', authMiddleware, orderController.payOrder);
router.post('/cancel', authMiddleware, orderController.cancelOrder);
router.get('/my', authMiddleware, orderController.getUserOrders);
router.get('/detail/:id', authMiddleware, orderController.getOrderDetail);

// 商家端
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
