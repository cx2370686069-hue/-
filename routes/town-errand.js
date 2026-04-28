const express = require('express');
const router = express.Router();
const townErrandController = require('../controllers/townErrandController');
const { authMiddleware } = require('../middleware/auth');

router.get('/stationmaster', authMiddleware, townErrandController.getTownErrandStationmaster);
router.post('/conversation/open', authMiddleware, townErrandController.openTownErrandConversation);
router.post('/order/create', authMiddleware, townErrandController.createTownErrandOrder);
router.get('/conversations', authMiddleware, townErrandController.getTownErrandConversations);
router.get('/conversations/:id/messages', authMiddleware, townErrandController.getTownErrandMessages);
router.post('/conversations/:id/messages', authMiddleware, townErrandController.sendTownErrandMessage);

module.exports = router;
