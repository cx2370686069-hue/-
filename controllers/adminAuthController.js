// 这个文件是“后台管理员认证控制器”。
// 只管后台管理员自己的登录、读取当前登录信息、退出登录，不处理普通用户或商家登录。
const { User } = require('../models');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');

// 这里专门把管理员资料整理成前端真正需要的返回结构。
// 这样登录接口和“当前登录人信息”接口都能复用同一套格式。
const formatAdminProfile = (user) => ({
  id: user.id,
  phone: user.phone,
  nickname: user.nickname,
  avatar: user.avatar,
  role: user.role,
  status: user.status
});

/**
 * 管理员登录
 * 这里只允许 role=admin 的账号登录后台，普通用户账号就算手机号和密码对，也进不来。
 */
exports.login = async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const password = req.body.password;

    if (!phone || !password) {
      return res.status(400).json(errorResponse('管理员账号和密码不能为空'));
    }

    const adminUser = await User.findOne({
      where: {
        phone,
        role: 'admin'
      }
    });

    if (!adminUser) {
      return res.status(400).json(errorResponse('管理员账号不存在'));
    }

    const isMatch = await adminUser.validatePassword(password);
    if (!isMatch) {
      return res.status(400).json(errorResponse('密码错误'));
    }

    if (Number(adminUser.status) !== 1) {
      return res.status(403).json(errorResponse('管理员账号已被禁用'));
    }

    res.json(successResponse({
      token: generateToken(adminUser.id),
      admin: formatAdminProfile(adminUser)
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前管理员信息
 * 后台刷新页面后想恢复登录态，通常会再调一次这个接口。
 */
exports.me = async (req, res, next) => {
  try {
    res.json(successResponse(formatAdminProfile(req.user)));
  } catch (error) {
    next(error);
  }
};

/**
 * 管理员退出登录
 * 目前这里主要是返回一个成功结果，真正的登录态失效还是以前端清 token 为主。
 */
exports.logout = async (req, res, next) => {
  try {
    res.json(successResponse(null, '退出成功'));
  } catch (error) {
    next(error);
  }
};
