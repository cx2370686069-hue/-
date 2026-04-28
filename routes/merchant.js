const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const reviewController = require('../controllers/reviewController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 公开路由（用户端）
router.get('/list', merchantController.getMerchantList);
router.get('/county-search', merchantController.searchCountyMerchants);
router.get('/detail/:id', merchantController.getMerchantDetail);
router.get('/categories', merchantController.getCategories);
router.get('/products', merchantController.getProducts);
router.get('/product/:id', merchantController.getProductDetail);  // 商品详情
router.get('/review-summary', reviewController.getMerchantReviewSummary);
router.get('/reviews', reviewController.getMerchantPublicReviews);

// 需要登录的路由（商家端）
router.post('/create', authMiddleware, roleMiddleware('merchant'), merchantController.createMerchant);
router.get('/my', authMiddleware, roleMiddleware('merchant'), merchantController.getMyMerchant);
router.get('/my-categories', authMiddleware, roleMiddleware('merchant'), merchantController.getMyCategories);
router.get('/info', authMiddleware, roleMiddleware('merchant'), merchantController.getMyMerchant); // 兼容前端请求
router.put('/update', authMiddleware, roleMiddleware('merchant'), merchantController.updateMerchant);
router.put('/info', authMiddleware, roleMiddleware('merchant'), merchantController.updateMerchant); // 兼容前端请求
router.put('/status', authMiddleware, roleMiddleware('merchant'), merchantController.updateMerchantStatus);  // 店铺状态
router.get('/stats', authMiddleware, roleMiddleware('merchant'), merchantController.getMerchantStats);  // 店铺统计

router.post('/category', authMiddleware, roleMiddleware('merchant'), merchantController.createCategory);
router.put('/category/:id', authMiddleware, roleMiddleware('merchant'), merchantController.updateCategory);
router.delete('/category/:id', authMiddleware, roleMiddleware('merchant'), merchantController.deleteCategory);
router.get('/my-products', authMiddleware, roleMiddleware('merchant'), merchantController.getMyProducts);  // 我的商品
router.post('/product', authMiddleware, roleMiddleware('merchant'), merchantController.createProduct);
// 兼容前端请求
router.post('/product/create', authMiddleware, roleMiddleware('merchant'), merchantController.createProduct);
router.put('/product/:id', authMiddleware, roleMiddleware('merchant'), merchantController.updateProduct);
router.delete('/product/:id', authMiddleware, roleMiddleware('merchant'), merchantController.deleteProduct);
router.put('/product/:id/status', authMiddleware, roleMiddleware('merchant'), merchantController.updateProductStatus);

router.get('/orders', authMiddleware, roleMiddleware('merchant'), merchantController.getMerchantOrders);

module.exports = router;
