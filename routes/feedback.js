// 这个文件是“用户反馈路由入口”。
// 用户提交投诉建议时，前端会先打到这里，再进入 feedbackController(反馈控制器)。
const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware } = require('../middleware/auth');

// 投诉建议必须绑定到当前登录用户，所以整组路由都要求先登录。
router.use(authMiddleware);

router.post('/', feedbackController.createFeedback);

module.exports = router;
