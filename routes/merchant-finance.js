// 这个文件是“商家财务路由入口”。
// 主要保留给旧商家端路径兼容使用，真实逻辑仍然走 financeController(财务控制器)。
const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 旧商家端财务路径同样要求先登录并且是商家账号。
router.use(authMiddleware);
router.use(roleMiddleware('merchant'));

// 财务统计与提现相关
router.get('/stats', financeController.getFinanceStats);
router.post('/withdraw', financeController.applyWithdraw);
router.get('/withdraw', financeController.getWithdrawRecords);

module.exports = router;
