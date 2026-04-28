const express = require('express');
const router = express.Router();
const paymentController = require('./controller');
const { authMiddleware } = require('../../middleware/auth');

router.post('/prepay', authMiddleware, paymentController.prepay);
router.post('/mock/confirm', authMiddleware, paymentController.mockConfirm);

router.post('/wechat/notify', paymentController.wechatNotify);
router.post('/alipay/notify', paymentController.alipayNotify);

module.exports = router;
