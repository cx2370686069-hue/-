const { User } = require('../models');
const { generateToken, successResponse, errorResponse } = require('../utils/helpers');

/**
 * 用户注册
 */
exports.register = async (req, res, next) => {
  try {
    const { phone, password, nickname, role = 'user' } = req.body;

    // 参数验证
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    // 检查手机号是否已存在
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return res.status(400).json(errorResponse('该手机号已注册'));
    }

    // 创建用户
    const user = await User.create({
      phone,
      password,
      nickname: nickname || `用户${phone.slice(7)}`,
      role,
      status: 1
    });

    // 生成 token
    const token = generateToken(user.id);

    res.status(201).json(successResponse({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role
      },
      token
    }, '注册成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 用户登录
 */
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // 参数验证
    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    // 查询用户
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(400).json(errorResponse('用户不存在'));
    }

    // 验证密码
    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(400).json(errorResponse('密码错误'));
    }

    // 检查用户状态
    if (user.status !== 1) {
      return res.status(403).json(errorResponse('账号已被禁用'));
    }

    // 生成 token
    const token = generateToken(user.id);

    res.json(successResponse({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        rider_status: user.rider_status,
        rider_balance: user.rider_balance,
        rider_kind: user.rider_kind,
        rider_town: user.rider_town
      },
      token
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户信息
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    
    res.json(successResponse({
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
      rider_status: user.rider_status,
      rider_balance: user.rider_balance,
      rider_kind: user.rider_kind,
      rider_town: user.rider_town
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户信息
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const { nickname, avatar } = req.body;

    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json(successResponse({
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role
    }, '更新成功'));
  } catch (error) {
    next(error);
  }
};
