const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

router.get('/service-areas', commonController.getServiceAreas);
router.get('/merchant-primary-categories', commonController.getMerchantPrimaryCategories);

module.exports = router;
