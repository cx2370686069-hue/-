const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const cartRouter = require('./cart');
const merchantRouter = require('./merchant');
const orderRouter = require('./order');
const addressRouter = require('./address');
const merchantDashboardRouter = require('./merchant-dashboard');
const payRouter = require('./pay');
const riderRouter = require('./rider');
const shopRouter = require('./shop');
const uploadRouter = require('./upload');
const commonRouter = require('./common');
const adminRouter = require('./admin');
const feedbackRouter = require('./feedback');
const notificationRouter = require('./notification');
const townErrandRouter = require('./town-errand');

// 测试/沙箱路由仅在非生产环境启用，避免线上身份伪造与免登录创建订单后门
const isProductionEnv = process.env.NODE_ENV === 'production';
const allowDevSandbox = !isProductionEnv && process.env.ENABLE_DEV_SANDBOX !== 'false';

// 挂载路由
if (allowDevSandbox) {
  router.use('/', require('./sandbox')); // 仅开发联调使用，禁止挂到生产
}
router.use('/upload', uploadRouter);
router.use('/auth', authRouter);
router.use('/merchant/cart', cartRouter); // 兼容现有前端路径
router.use('/cart', cartRouter); // 预留标准购物车路径
router.use('/merchant', merchantRouter);
router.use('/shop', shopRouter);
router.use('/order', orderRouter);
router.use('/orders', orderRouter);
router.use('/address', addressRouter);
router.use('/merchant', merchantDashboardRouter); // 商家端工作台、财务、评价
router.use('/pay', payRouter);
router.use('/rider', riderRouter);
router.use('/common', commonRouter);
router.use('/feedback', feedbackRouter);
router.use('/notifications', notificationRouter);
router.use('/town-errand', townErrandRouter);
router.use('/admin', adminRouter);
if (allowDevSandbox) {
  router.use('/test', require('./test'));
}
// 兼容前端请求
router.use('/product', merchantRouter);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', timestamp: new Date().toISOString() });
});

module.exports = router;
