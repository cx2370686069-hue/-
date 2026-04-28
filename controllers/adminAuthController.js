const { User } = require('../models');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');

const formatAdminProfile = (user) => ({
  id: user.id,
  phone: user.phone,
  nickname: user.nickname,
  avatar: user.avatar,
  role: user.role,
  status: user.status
});

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

exports.me = async (req, res, next) => {
  try {
    res.json(successResponse(formatAdminProfile(req.user)));
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    res.json(successResponse(null, '退出成功'));
  } catch (error) {
    next(error);
  }
};
