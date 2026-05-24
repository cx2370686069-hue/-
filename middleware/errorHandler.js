// 这个文件是“全局错误处理中间件”。
// 所有没有被前面正常处理掉的异常，最终都会汇总到这里，统一返回前端能识别的错误格式。
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // 统一响应格式：这里所有错误都会返回 code / message / data 这一套结构。
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

  // 兜底错误：开发环境保留真实报错，生产环境的 500 则尽量隐藏内部细节。
  res.status(responseCode).json({
    code: responseCode,
    message: safeMessage,
    data: null
  });
};

module.exports = errorHandler;
