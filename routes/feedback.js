const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', feedbackController.createFeedback);

module.exports = router;
