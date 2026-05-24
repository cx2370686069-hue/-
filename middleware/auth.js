const jwt = require('jsonwebtoken');
const { User } = require('../models');

// 这个文件是“登录鉴权中间件”。
// 它主要提供两层能力：
// 1. authMiddleware(登录鉴权)：把 token 解析成当前登录用户
// 2. roleMiddleware(角色鉴权)：在已登录基础上继续校验角色

// 验证 JWT Token
const authMiddleware = async (req, res, next) => {
  try {
    // 同时兼容 Authorization: Bearer xxx 和旧版 token 请求头。
    const authValue = req.headers.authorization;
    const rawToken = req.headers.token;
    const token = authValue
      ? authValue.startsWith('Bearer ')
        ? authValue.slice('Bearer '.length)
        : authValue
      : rawToken;
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: '请先登录'
      });
    }

    // 先验 token，再去数据库确认这个账号仍然有效。
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 账号被禁用或不存在，也视为登录失效。
    const user = await User.findByPk(decoded.userId);
    
    if (!user || user.status !== 1) {
      return res.status(401).json({
        code: 401,
        message: '登录已失效'
      });
    }

    // 通过鉴权后，把当前用户对象挂到 req.user，供后面的控制器和中间件复用。
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      code: 401,
      message: '登录已失效'
    });
  }
};

// 角色鉴权：只允许指定角色继续访问。
const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '请先登录'
      });
    }

    if (!roles.includes(req.user.role)) {
      console.error(`权限被拒绝: userId=${req.user.id}, 当前角色=${req.user.role}, 期望角色=${roles.join(',')}`);
      return res.status(403).json({
        code: 403,
        message: '没有权限访问'
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware
};
