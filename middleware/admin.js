const { errorResponse } = require('../utils/helpers');

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
