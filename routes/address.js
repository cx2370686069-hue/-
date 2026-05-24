// 这个文件是“地址路由入口”。
// 用户地址的列表、默认地址、新增、修改、删除，都会先经过这里再进入 addressController(地址控制器)。
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/auth');

// 地址属于用户私有数据，所以这里整组路由都必须先登录。
router.use(authMiddleware);

// 地址查询相关
router.get('/list', addressController.getAddressList);
router.get('/default', addressController.getDefaultAddress);

// 地址新增 / 修改 / 删除相关
router.post('/create', addressController.createAddress);
router.put('/update', addressController.updateAddress);
router.delete('/delete/:id', addressController.deleteAddress);
router.post('/set-default', addressController.setDefaultAddress);

module.exports = router;
