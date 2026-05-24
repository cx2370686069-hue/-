// 这个文件是“乡镇站长审核路由入口”。
// 乡镇站长审核商家申请、审核骑手申请，都会先打到这里，再分发给对应控制器。
const express = require('express');
const router = express.Router();
const townStationMerchantController = require('../controllers/townStationMerchantController');
const townStationRiderController = require('../controllers/townStationRiderController');
const { authMiddleware } = require('../middleware/auth');

// 乡镇商家审核
router.get(
  '/merchant-applications',
  authMiddleware,
  townStationMerchantController.getMerchantApplications
);

router.get(
  '/merchant-applications/:id',
  authMiddleware,
  townStationMerchantController.getMerchantApplicationDetail
);

router.post(
  '/merchant-applications/:id/approve',
  authMiddleware,
  townStationMerchantController.approveMerchantApplication
);

router.post(
  '/merchant-applications/:id/reject',
  authMiddleware,
  townStationMerchantController.rejectMerchantApplication
);

// 乡镇骑手审核
router.get(
  '/rider-applications',
  authMiddleware,
  townStationRiderController.getRiderApplications
);

router.get(
  '/rider-applications/:id',
  authMiddleware,
  townStationRiderController.getRiderApplicationDetail
);

router.post(
  '/rider-applications/:id/approve',
  authMiddleware,
  townStationRiderController.approveRiderApplication
);

router.post(
  '/rider-applications/:id/reject',
  authMiddleware,
  townStationRiderController.rejectRiderApplication
);

module.exports = router;
