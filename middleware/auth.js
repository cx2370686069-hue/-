const jwt = require('jsonwebtoken');
const { User } = require('../models');

// 验证 JWT Token
const authMiddleware = async (req, res, next) => {
  try {
    // 从请求头获取 token
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

    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查询用户
    const user = await User.findByPk(decoded.userId);
    
    if (!user || user.status !== 1) {
      return res.status(401).json({
        code: 401,
        message: '登录已失效'
      });
    }

    // 将用户信息附加到请求对象
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

// 验证角色
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
