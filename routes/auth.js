// 这个文件是“认证路由入口”。
// 普通用户注册、商家注册、骑手注册、登录、当前用户资料、修改资料、换绑手机号，都从这里进 authController(认证控制器)。
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// 公开认证路由：注册和登录都不需要先登录。
router.post('/register', authController.register);
router.post('/register/merchant', authController.registerMerchant);
router.post('/register/rider', authController.registerRider);
router.post('/merchant-binding/resolve', authController.resolveMerchantBinding);
router.post('/login', authController.login);

// 登录后的账号资料路由。
router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/phone', authMiddleware, authController.changePhone);

module.exports = router;
