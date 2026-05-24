// 这个文件是“乡镇跑腿路由入口”。
// 查询乡镇站长、打开会话、查看消息、发送消息、创建乡镇跑腿订单，都会先打到这里。
const express = require('express');
const router = express.Router();
const townErrandController = require('../controllers/townErrandController');
const { authMiddleware } = require('../middleware/auth');

// 跑腿会话和跑腿下单都和当前用户身份绑定，所以这里统一要求先登录。
router.get('/stationmaster', authMiddleware, townErrandController.getTownErrandStationmaster);
router.post('/conversation/open', authMiddleware, townErrandController.openTownErrandConversation);
router.post('/order/create', authMiddleware, townErrandController.createTownErrandOrder);
router.get('/conversations', authMiddleware, townErrandController.getTownErrandConversations);
router.get('/conversations/:id/messages', authMiddleware, townErrandController.getTownErrandMessages);
router.post('/conversations/:id/messages', authMiddleware, townErrandController.sendTownErrandMessage);

module.exports = router;
