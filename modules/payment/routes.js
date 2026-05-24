const express = require('express');
const router = express.Router();
const paymentController = require('./controller');
const { authMiddleware } = require('../../middleware/auth');

// 这个文件是“支付模块路由入口”。
// 它只负责把请求分发给 controller(控制器)，真正的支付处理不写在这里。
router.post('/prepay', authMiddleware, paymentController.prepay);
router.post('/mock/confirm', authMiddleware, paymentController.mockConfirm);

// 第三方平台回调不能依赖前端登录态，所以这里故意不挂 authMiddleware。
router.post('/wechat/notify', paymentController.wechatNotify);
router.post('/alipay/notify', paymentController.alipayNotify);

module.exports = router;
