const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/unread-count', notificationController.getUnreadNotificationCount);
router.get('/', notificationController.getPublishedNotifications);
router.get('/:id', notificationController.getPublishedNotificationDetail);

module.exports = router;
