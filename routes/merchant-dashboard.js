const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const financeController = require('../controllers/financeController');
const reviewController = require('../controllers/reviewController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 所有路由都需要商家权限
router.use(authMiddleware);
router.use(roleMiddleware('merchant'));

// 工作台
router.get('/dashboard', dashboardController.getDashboard);

// 统计
router.get('/stats', dashboardController.getStats);
router.get('/hot-products', dashboardController.getHotProducts);

// 财务
router.get('/finance/stats', financeController.getFinanceStats);
router.post('/finance/withdraw', financeController.applyWithdraw);
router.get('/finance/withdraw', financeController.getWithdrawRecords);

// 评价
router.get('/reviews', reviewController.getReviews);
router.post('/reviews/:order_id/reply', reviewController.replyReview);

module.exports = router;
