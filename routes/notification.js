// 这个文件是“用户端通知路由入口”。
// 用户查看通知列表、通知详情、未读数量时，都会先经过这里。
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

// 通知和已读状态都与当前用户绑定，所以整组路由都要求先登录。
router.use(authMiddleware);

// 通知列表与未读统计
router.get('/unread-count', notificationController.getUnreadNotificationCount);
router.get('/', notificationController.getPublishedNotifications);
router.get('/:id', notificationController.getPublishedNotificationDetail);

module.exports = router;
