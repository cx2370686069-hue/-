const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// 公开路由（不需要登录）
router.post('/register', authController.register);
router.post('/register/merchant', authController.registerMerchant);
router.post('/register/rider', authController.registerRider);
router.post('/login', authController.login);

// 需要登录的路由
router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/phone', authMiddleware, authController.changePhone);

module.exports = router;
