const { Address } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

/**
 * 获取用户地址列表
 */
exports.getAddressList = async (req, res, next) => {
  try {
    const user = req.user;
    
    const addresses = await Address.findAll({
      where: { user_id: user.id },
      order: [['is_default', 'DESC'], ['id', 'DESC']]
    });

    res.json(successResponse(addresses));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取默认地址
 */
exports.getDefaultAddress = async (req, res, next) => {
  try {
    const user = req.user;
    
    const address = await Address.findOne({
      where: { user_id: user.id, is_default: true }
    });

    res.json(successResponse(address));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建地址
 */
exports.createAddress = async (req, res, next) => {
  try {
    const user = req.user;
    const { is_default, ...addressData } = req.body;

    // 如果设置为默认地址，取消其他默认
    if (is_default) {
      await Address.update(
        { is_default: false },
        { where: { user_id: user.id } }
      );
    }

    const address = await Address.create({
      user_id: user.id,
      ...addressData,
      is_default: is_default || false
    });

    res.status(201).json(successResponse(address, '地址添加成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新地址
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const user = req.user;
    const { id, is_default, ...addressData } = req.body;

    const address = await Address.findOne({
      where: { id, user_id: user.id }
    });

    if (!address) {
      return res.status(404).json(errorResponse('地址不存在'));
    }

    // 如果设置为默认地址，取消其他默认
    if (is_default) {
      await Address.update(
        { is_default: false },
        { where: { user_id: user.id, id: { [require('sequelize').Op.ne]: id } } }
      );
    }

    await address.update({
      ...addressData,
      is_default: is_default !== undefined ? is_default : address.is_default
    });

    res.json(successResponse(address, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除地址
 */
exports.deleteAddress = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const address = await Address.findOne({
      where: { id, user_id: user.id }
    });

    if (!address) {
      return res.status(404).json(errorResponse('地址不存在'));
    }

    await address.destroy();

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 设置默认地址
 */
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.body;

    const address = await Address.findOne({
      where: { id, user_id: user.id }
    });

    if (!address) {
      return res.status(404).json(errorResponse('地址不存在'));
    }

    // 取消其他默认
    await Address.update(
      { is_default: false },
      { where: { user_id: user.id } }
    );

    // 设置当前为默认
    await address.update({ is_default: true });

    res.json(successResponse(address, '设置成功'));
  } catch (error) {
    next(error);
  }
};
