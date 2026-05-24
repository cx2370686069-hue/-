// 这个文件就是“用户收货地址控制器”。
// 主要负责地址列表、默认地址、新增、修改、删除这些基础地址操作。
const { Address } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

/**
 * 获取用户地址列表
 * 这里只查当前登录用户自己的地址，并且会把默认地址排在最前面。
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
 * 前端下单时如果想直接拿“当前默认地址”，一般就是调这个接口。
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
 * 如果这次新建地址时勾了“默认地址”，这里会先把这个用户原来的默认地址全部取消掉。
 */
exports.createAddress = async (req, res, next) => {
  try {
    const user = req.user;
    const { is_default, ...addressData } = req.body;

    // 一个用户同一时间只能有一个默认地址。
    // 所以这里一旦新地址要设为默认，就先把旧的默认地址全部取消掉。
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
 * 这里只允许修改“当前登录用户自己的地址”。
 * 如果改成默认地址，也会同步把其他默认地址取消掉。
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

    // 如果这次把当前地址改成默认地址，就要把其他地址的默认标记一起清掉。
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
 * 这里只删除当前用户自己的地址，不允许越权删别人的地址。
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
 * 这个接口的作用很单纯：把当前选中的地址设成默认，并取消其他默认地址。
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

    // 先把当前用户的其他地址全部取消默认。
    await Address.update(
      { is_default: false },
      { where: { user_id: user.id } }
    );

    // 再把当前这条地址设成默认地址。
    await address.update({ is_default: true });

    res.json(successResponse(address, '设置成功'));
  } catch (error) {
    next(error);
  }
};
