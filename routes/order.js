// 这个文件是“订单路由总入口”。
// 用户下单、支付、查单、商家接单出餐、骑手接单配送、转派、跑腿单，主要都先从这里分流到 orderController(订单控制器)。
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 用户端订单主链路：下单、支付、取消、评价、我的订单、订单详情。
// 这组都要求先登录，但不强制限定角色为 merchant / rider。
router.post('/delivery-fee/estimate', authMiddleware, orderController.estimateDeliveryFee);
router.post('/county-group/estimate', authMiddleware, orderController.estimateCountyGroupOrder);
router.post('/county-group/create', authMiddleware, orderController.createCountyGroupOrder);
router.post('/county-group/pay', authMiddleware, orderController.payCountyGroupOrder);
router.post('/create', authMiddleware, orderController.createOrder);
router.post('/pay', authMiddleware, orderController.payOrder);
router.post('/cancel', authMiddleware, orderController.cancelOrder);
router.post('/user/hide-batch', authMiddleware, orderController.hideUserOrdersBatch);
router.post('/review', authMiddleware, orderController.submitReview);
router.get('/my', authMiddleware, orderController.getUserOrders);
// 用户端“查看订单位置”高频刷新时，只取轻量骑手位置数据，避免每 15 秒反复拉整包详情。
router.get('/live-location/:id', authMiddleware, orderController.getOrderLiveLocation);
router.get('/detail/:id', authMiddleware, orderController.getOrderDetail);
router.get('/county-group/detail/:id', authMiddleware, orderController.getCountyGroupOrderDetail);

// 商家端订单处理链路：接单、拒单、选择超市配送方式、出餐、发货、店铺自配送送达。
router.get('/merchant/list', authMiddleware, roleMiddleware('merchant'), require('../controllers/merchantController').getMerchantOrders);
router.post('/accept', authMiddleware, roleMiddleware('merchant'), orderController.acceptOrder);
router.post('/reject', authMiddleware, roleMiddleware('merchant'), orderController.rejectOrder);
router.post('/supermarket/delivery-mode', authMiddleware, roleMiddleware('merchant'), orderController.selectSupermarketDeliveryMode);
router.post('/prepare', authMiddleware, roleMiddleware('merchant'), orderController.prepareOrder);
router.post('/deliver', authMiddleware, roleMiddleware('merchant', 'merchant_delivery'), orderController.deliverOrder);
router.post('/merchant-confirm-delivery', authMiddleware, roleMiddleware('merchant', 'merchant_delivery'), orderController.confirmMerchantSelfDelivery);

// 骑手端配送链路：接单、确认送达、转派、查看可见订单、查看配送中订单、切换在线状态。
router.post('/accept-takeout', authMiddleware, roleMiddleware('rider'), orderController.acceptTakeoutOrder);
router.post('/confirm-delivery', authMiddleware, roleMiddleware('rider'), orderController.confirmDelivery);
router.post('/confirm-delivery-special', authMiddleware, roleMiddleware('rider'), orderController.confirmDeliverySpecial);
router.get('/transfer/stationmasters', authMiddleware, roleMiddleware('rider'), orderController.getTransferStationmasters);
router.get('/transfer/town-riders', authMiddleware, roleMiddleware('rider'), orderController.getTransferTownRiders);
router.post('/transfer/to-stationmaster', authMiddleware, roleMiddleware('rider'), orderController.transferOrderToStationmaster);
router.post('/transfer/to-town-rider', authMiddleware, roleMiddleware('rider'), orderController.transferOrderToTownRider);
router.post('/transfer/revoke', authMiddleware, roleMiddleware('rider'), orderController.revokeTransferredOrder);
router.post('/rider-status', authMiddleware, roleMiddleware('rider'), orderController.updateRiderStatus);
router.get('/available', authMiddleware, roleMiddleware('rider'), orderController.getAvailableOrders);
router.get('/rider-orders', authMiddleware, roleMiddleware('rider', 'merchant_delivery'), orderController.getRiderOrders);

// 跑腿订单链路
router.post('/errand/publish', authMiddleware, orderController.publishErrand);
router.get('/errand/list', authMiddleware, orderController.getErrandList);
router.post('/errand/accept', authMiddleware, roleMiddleware('rider'), orderController.acceptErrand);
router.post('/errand/complete', authMiddleware, roleMiddleware('rider'), orderController.completeErrand);

module.exports = router;
