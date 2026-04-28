const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/auth');

// 用户端购物车
router.get('/list', authMiddleware, cartController.getCartList);
router.post('/add', authMiddleware, cartController.addToCart);
router.post('/remove', authMiddleware, cartController.removeFromCart);
router.post('/clear', authMiddleware, cartController.clearCart);

module.exports = router;
