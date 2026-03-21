const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const merchantRouter = require('./merchant');
const orderRouter = require('./order');
const addressRouter = require('./address');
const merchantDashboardRouter = require('./merchant-dashboard');
const payRouter = require('./pay');
const riderRouter = require('./rider');

// 挂载路由
router.use('/auth', authRouter);
router.use('/merchant', merchantRouter);
router.use('/order', orderRouter);
router.use('/address', addressRouter);
router.use('/merchant', merchantDashboardRouter); // 商家端工作台、财务、评价
router.use('/pay', payRouter);
router.use('/rider', riderRouter);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', timestamp: new Date().toISOString() });
});

module.exports = router;
