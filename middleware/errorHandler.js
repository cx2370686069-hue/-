// 全局错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // 统一响应格式：前端要求的 { code: 1, msg: 'xxx', data: null } 或 { code: 0, message: 'xxx', data: {...} }
  // 这里统一错误时的 code 非 0
  const responseCode = err.status || 500;
  
  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      code: 400,
      message: '参数验证失败: ' + err.errors.map(e => e.message).join(', '),
      data: null
    });
  }

  // Sequelize 唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      code: 400,
      message: '数据已存在',
      data: null
    });
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      code: 401,
      message: 'Token 无效',
      data: null
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      code: 401,
      message: 'Token 已过期',
      data: null
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const safeMessage =
    responseCode >= 500 && isProduction
      ? '服务器内部错误'
      : (err.message || '服务器内部错误');

  // 默认错误
  res.status(responseCode).json({
    code: responseCode,
    message: safeMessage,
    data: null
  });
};

module.exports = errorHandler;
