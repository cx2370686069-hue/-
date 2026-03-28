const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const orderController = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/station/bind', authMiddleware, roleMiddleware('rider'), riderController.bindStationTown);
router.post('/location/report', authMiddleware, roleMiddleware('rider'), riderController.reportLocation);
router.get('/locations', authMiddleware, riderController.getOnlineRiderLocations);
router.get('/orders', authMiddleware, roleMiddleware('rider'), riderController.getMyAssignedOrders);

// 骑手接单
router.post('/order/accept', authMiddleware, roleMiddleware('rider'), orderController.riderAccept);

// 骑手取餐
router.post('/order/pickup', authMiddleware, roleMiddleware('rider'), orderController.riderPickup);

module.exports = router;

