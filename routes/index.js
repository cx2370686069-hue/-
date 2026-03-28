const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const merchantRouter = require('./merchant');
const orderRouter = require('./order');
const addressRouter = require('./address');
const merchantDashboardRouter = require('./merchant-dashboard');
const payRouter = require('./pay');
const riderRouter = require('./rider');
const testRouter = require('./test');
const shopRouter = require('./shop');

// 挂载路由
router.use('/', require('./sandbox')); // 暴露直接给前端测试的 /api/products, /api/orders
router.use('/auth', authRouter);
router.use('/merchant', merchantRouter);
router.use('/shop', shopRouter);
router.use('/order', orderRouter);
router.use('/orders', orderRouter);
router.use('/address', addressRouter);
router.use('/merchant', merchantDashboardRouter); // 商家端工作台、财务、评价
router.use('/pay', payRouter);
router.use('/rider', riderRouter);
router.use('/test', testRouter);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', timestamp: new Date().toISOString() });
});

module.exports = router;
