// 这个文件是“公共查询路由入口”。
// 服务区域、区域搜索、坐标反查区域、商家主营类目这些不依赖具体业务身份的公共能力，都挂这里。
const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

// 服务区域与类目公共接口
router.get('/service-areas', commonController.getServiceAreas);
router.get('/area-search', commonController.searchServiceAreas);
router.get('/service-areas/search', commonController.searchServiceAreas);
router.get('/service-areas/resolve-by-location', commonController.resolveServiceAreaByLocation);
router.get('/merchant-primary-categories', commonController.getMerchantPrimaryCategories);

module.exports = router;
