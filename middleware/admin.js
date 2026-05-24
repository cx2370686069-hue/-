const { errorResponse } = require('../utils/helpers');

// 这个中间件专门拦“后台管理员权限”。
// 只有已经登录，并且 req.user.role === 'admin' 的请求才能继续往下走。
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(errorResponse('请先登录', 401));
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json(errorResponse('仅管理员可访问', 403));
  }

  next();
};

module.exports = {
  adminMiddleware
};
