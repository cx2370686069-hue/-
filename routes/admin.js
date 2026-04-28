const express = require('express');
const router = express.Router();

const adminAuthController = require('../controllers/adminAuthController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminMerchantController = require('../controllers/adminMerchantController');
const adminRiderController = require('../controllers/adminRiderController');
const adminNotificationController = require('../controllers/adminNotificationController');
const adminFeedbackController = require('../controllers/adminFeedbackController');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

router.post('/auth/login', adminAuthController.login);

router.get('/auth/me', authMiddleware, adminMiddleware, adminAuthController.me);
router.post('/auth/logout', authMiddleware, adminMiddleware, adminAuthController.logout);

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard/overview', adminDashboardController.getOverview);
router.get('/dashboard/pending-counts', adminDashboardController.getPendingCounts);

router.get('/merchant/pending', adminMerchantController.getPendingMerchants);
router.get('/merchant/:id', adminMerchantController.getMerchantAuditDetail);
router.put('/merchant/:id/approve', adminMerchantController.approveMerchant);
router.put('/merchant/:id/reject', adminMerchantController.rejectMerchant);

router.get('/rider/pending', adminRiderController.getPendingRiders);
router.get('/rider/:id', adminRiderController.getRiderAuditDetail);
router.put('/rider/:id/approve', adminRiderController.approveRider);
router.put('/rider/:id/reject', adminRiderController.rejectRider);

router.get('/notifications', adminNotificationController.getNotifications);
router.post('/notifications', adminNotificationController.createNotification);
router.put('/notifications/:id', adminNotificationController.updateNotification);
router.delete('/notifications/:id', adminNotificationController.deleteNotification);
router.post('/notifications/:id/publish', adminNotificationController.publishNotification);
router.post('/notifications/:id/offline', adminNotificationController.offlineNotification);
router.post('/notifications/:id/pin', adminNotificationController.pinNotification);
router.get('/feedback', adminFeedbackController.getFeedbackList);
router.get('/feedback/:id', adminFeedbackController.getFeedbackDetail);
router.put('/feedback/:id/status', adminFeedbackController.updateFeedbackStatus);

module.exports = router;
