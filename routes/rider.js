// 这个文件是“骑手能力路由入口”。
// 乡镇站长绑定、位置上报、在线骑手位置、今日统计、我的可见订单、骑手取餐，都先从这里进。
const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const orderController = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 骑手基础能力
router.post('/station/bind', authMiddleware, roleMiddleware('rider'), riderController.bindStationTown);
router.post('/location/report', authMiddleware, roleMiddleware('rider', 'merchant_delivery'), riderController.reportLocation);
router.get('/locations', authMiddleware, riderController.getOnlineRiderLocations);
router.get('/orders', authMiddleware, roleMiddleware('rider'), riderController.getMyAssignedOrders);
router.get('/today-summary', authMiddleware, roleMiddleware('rider', 'merchant_delivery'), riderController.getTodaySummary);

// 骑手配送动作
router.post('/order/pickup', authMiddleware, roleMiddleware('rider'), orderController.riderPickup);

module.exports = router;

