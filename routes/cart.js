// 这个文件是“购物车路由入口”。
// 用户端购物车列表、加商品、减商品、清空购物车，都会先经过这里。
const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/auth');

// 购物车属于用户私有数据，所以每条路由都要求先登录。
router.get('/list', authMiddleware, cartController.getCartList);
router.post('/add', authMiddleware, cartController.addToCart);
router.post('/remove', authMiddleware, cartController.removeFromCart);
router.post('/clear', authMiddleware, cartController.clearCart);

module.exports = router;
