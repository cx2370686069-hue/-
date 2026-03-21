const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authMiddleware } = require('../middleware/auth');

// 所有路由都需要登录
router.use(authMiddleware);

router.get('/list', addressController.getAddressList);
router.get('/default', addressController.getDefaultAddress);
router.post('/create', addressController.createAddress);
router.put('/update', addressController.updateAddress);
router.delete('/delete/:id', addressController.deleteAddress);
router.post('/set-default', addressController.setDefaultAddress);

module.exports = router;
