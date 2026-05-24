// 这个文件是“全站路由聚合入口”。
// 其他路由文件都先在这里统一挂载，再由 app(应用入口) 把这里整体挂到 /api 等顶层前缀下。
const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const cartRouter = require('./cart');
const merchantRouter = require('./merchant');
const orderRouter = require('./order');
const addressRouter = require('./address');
const merchantDashboardRouter = require('./merchant-dashboard');
const merchantFinanceRouter = require('./merchant-finance');
const payRouter = require('./pay');
const riderRouter = require('./rider');
const shopRouter = require('./shop');
const uploadRouter = require('./upload');
const commonRouter = require('./common');
const mapRouter = require('./map');
const adminRouter = require('./admin');
const feedbackRouter = require('./feedback');
const notificationRouter = require('./notification');
const townErrandRouter = require('./town-errand');
const townStationRouter = require('./town-station');

// 测试 / 沙箱路由只允许在非生产环境启用，避免线上暴露免登录或伪造身份的后门。
const isProductionEnv = process.env.NODE_ENV === 'production';
const allowDevSandbox = !isProductionEnv && process.env.ENABLE_DEV_SANDBOX !== 'false';

// 开发联调专用入口
if (allowDevSandbox) {
  router.use('/', require('./sandbox')); // 仅开发联调使用，禁止挂到生产
}

// 常规业务路由挂载区
router.use('/upload', uploadRouter);
router.use('/auth', authRouter);
router.use('/merchant/cart', cartRouter); // 兼容现有前端路径
router.use('/cart', cartRouter); // 预留标准购物车路径
router.use('/merchant', merchantRouter);
router.use('/merchant/dashboard', merchantDashboardRouter); // 商家后台正式前缀
router.use('/merchant-dashboard', merchantDashboardRouter); // 兼容旧商家端模块名前缀
router.use('/merchant/finance', merchantFinanceRouter); // 兼容既有财务页路径
router.use('/shop', shopRouter);
router.use('/order', orderRouter);
router.use('/orders', orderRouter);
router.use('/address', addressRouter);
router.use('/pay', payRouter);
router.use('/rider', riderRouter);
router.use('/common', commonRouter);
router.use('/map', mapRouter);
router.use('/feedback', feedbackRouter);
router.use('/notifications', notificationRouter);
router.use('/town-errand', townErrandRouter);
router.use('/town-station', townStationRouter);
router.use('/admin', adminRouter);

// 测试工具路由也只在开发环境开放。
if (allowDevSandbox) {
  router.use('/test', require('./test'));
}

// 兼容前端请求
router.use('/product', merchantRouter);

// 健康检查接口：主要给部署环境或网关探活使用。
router.get('/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', timestamp: new Date().toISOString() });
});

module.exports = router;
