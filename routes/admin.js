// 这个文件是“后台管理路由总入口”。
// 后台管理员登录、概览统计、商家审核、骑手审核、订单管理、通知管理、反馈处理，都会先挂到这里。
const express = require('express');
const router = express.Router();

const adminAuthController = require('../controllers/adminAuthController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminMerchantController = require('../controllers/adminMerchantController');
const adminRiderController = require('../controllers/adminRiderController');
const adminOrderController = require('../controllers/adminOrderController');
const adminNotificationController = require('../controllers/adminNotificationController');
const adminFeedbackController = require('../controllers/adminFeedbackController');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

// 后台登录是唯一一个公开入口，不要求先带登录态。
router.post('/auth/login', adminAuthController.login);

// 已登录后台管理员读取自己的资料、退出登录，需要先过登录校验和管理员权限校验。
router.get('/auth/me', authMiddleware, adminMiddleware, adminAuthController.me);
router.post('/auth/logout', authMiddleware, adminMiddleware, adminAuthController.logout);

// 从这里开始，下面所有后台路由都必须同时满足：
// 1. 已登录
// 2. 当前账号是后台管理员
router.use(authMiddleware, adminMiddleware);

// 后台首页概览
router.get('/dashboard/overview', adminDashboardController.getOverview);
router.get('/dashboard/pending-counts', adminDashboardController.getPendingCounts);

// 商家审核管理
router.get('/merchant/pending', adminMerchantController.getPendingMerchants);
router.get('/merchant/:id', adminMerchantController.getMerchantAuditDetail);
router.put('/merchant/:id/approve', adminMerchantController.approveMerchant);
router.put('/merchant/:id/reject', adminMerchantController.rejectMerchant);

// 骑手 / 商家自配送员审核管理
router.get('/rider/pending', adminRiderController.getPendingRiders);
router.get('/rider', adminRiderController.getRiderList);
router.get('/rider/:id', adminRiderController.getRiderAuditDetail);
router.put('/rider/:id/approve', adminRiderController.approveRider);
router.put('/rider/:id/reject', adminRiderController.rejectRider);
router.delete('/rider/:id', adminRiderController.deleteMerchantDeliveryRider);

// 后台订单管理
router.get('/orders', adminOrderController.getOrderList);
router.get('/orders/:id', adminOrderController.getOrderDetail);
router.put('/orders/:id/cancel-audit', adminOrderController.auditCancelOrder);

// 后台系统通知管理
router.get('/notifications', adminNotificationController.getNotifications);
router.post('/notifications', adminNotificationController.createNotification);
router.put('/notifications/:id', adminNotificationController.updateNotification);
router.delete('/notifications/:id', adminNotificationController.deleteNotification);
router.post('/notifications/:id/publish', adminNotificationController.publishNotification);
router.post('/notifications/:id/offline', adminNotificationController.offlineNotification);
router.post('/notifications/:id/pin', adminNotificationController.pinNotification);

// 后台投诉建议管理
router.get('/feedback', adminFeedbackController.getFeedbackList);
router.get('/feedback/:id', adminFeedbackController.getFeedbackDetail);
router.put('/feedback/:id/status', adminFeedbackController.updateFeedbackStatus);

module.exports = router;
