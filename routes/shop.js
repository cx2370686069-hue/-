// 这个文件是“旧商家前缀路由入口”。
// 主要兼容 /shop 这类历史前端路径，真实能力还是分发到 dashboardController(工作台控制器) 和 merchantController(商家控制器)。
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const merchantController = require('../controllers/merchantController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 旧商家前缀同样要求登录，并且当前账号角色是 merchant(商家)。
router.use(authMiddleware);
router.use(roleMiddleware('merchant'));

// 商家工作台首页
router.get('/dashboard', dashboardController.getDashboard);

// 商家自己的店铺信息
router.get('/my', merchantController.getMyMerchant);

module.exports = router;
