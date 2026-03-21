const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/station/bind', authMiddleware, roleMiddleware('rider'), riderController.bindStationTown);
router.post('/location/report', authMiddleware, roleMiddleware('rider'), riderController.reportLocation);
router.get('/locations', authMiddleware, riderController.getOnlineRiderLocations);
router.get('/orders', authMiddleware, roleMiddleware('rider'), riderController.getMyAssignedOrders);

module.exports = router;

