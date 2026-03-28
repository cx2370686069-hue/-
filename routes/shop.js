const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const merchantController = require('../controllers/merchantController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 所有 /api/shop 下的路由都需要商家权限
router.use(authMiddleware);
router.use(roleMiddleware('merchant'));

// 1. 商家工作台数据 (GET /api/shop/dashboard)
router.get('/dashboard', dashboardController.getDashboard);

// 3. 商家店铺信息 (GET /api/shop/my)
router.get('/my', merchantController.getMyMerchant);

module.exports = router;