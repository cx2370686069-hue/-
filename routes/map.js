// 这个文件是“地图能力路由入口”。
// 逆地理解析、地点联想、地点搜索这些地图相关接口，统一从这里转到 mapController(地图控制器)。
const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');

// 地图公共查询接口
router.get('/reverse-geocode', mapController.reverseGeocode);
router.get('/suggest', mapController.suggest);
router.get('/search', mapController.search);
router.get('/nearby', mapController.nearby);

// 骑手送货总览专用接口
// 这里返回的是“按最近距离串联后的真实骑行折线”，给 H5 总览页直接画蓝线。
router.post('/rider-delivery-route', mapController.riderDeliveryRoute);

module.exports = router;
