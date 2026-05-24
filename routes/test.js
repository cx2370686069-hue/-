// 这个文件是“开发测试路由”。
// 主要用于本地调试时快速造登录态或联动 socket 推送，不能在生产环境对外开放。
const express = require('express');
const jwt = require('jsonwebtoken');
const { Order, Merchant, User } = require('../models');
const { generateOrderNo, successResponse, errorResponse } = require('../utils/helpers');
const socketService = require('../services/socketService');

const router = express.Router();

// 一键生成测试骑手 token，方便本地联调。
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
