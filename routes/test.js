const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/super-login', async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({
        code: 400,
        message: 'phone 不能为空'
      });
    }

    const token = jwt.sign(
      {
        id: 5,
        phone: '13800000001',
        role: 'rider'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
