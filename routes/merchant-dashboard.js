// 这个文件是“商家工作台路由入口”。
// 商家后台首页概览、趋势统计、热销商品、财务统计、评价管理，都统一挂在这个前缀下面。
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const financeController = require('../controllers/financeController');
const reviewController = require('../controllers/reviewController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 整组路由都要求：
// 1. 已登录
// 2. 当前账号角色是 merchant(商家)
router.use(authMiddleware);
router.use(roleMiddleware('merchant'));

// 工作台首页根接口：挂载到 /merchant/dashboard 后，对外即 GET /merchant/dashboard
router.get('/', dashboardController.getDashboard);

// 工作台统计相关
router.get('/stats', dashboardController.getStats);
router.get('/hot-products', dashboardController.getHotProducts);

// 工作台里的财务相关快捷入口
router.get('/finance/stats', financeController.getFinanceStats);
router.post('/finance/withdraw', financeController.applyWithdraw);
router.get('/finance/withdraw', financeController.getWithdrawRecords);

// 工作台里的评价管理入口
router.get('/reviews', reviewController.getReviews);
router.post('/reviews/:order_id/reply', reviewController.replyReview);

module.exports = router;
