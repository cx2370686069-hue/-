const { User, Order, Merchant } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

exports.bindStationTown = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    const town = String(req.body?.town || '').trim();
    if (!town) {
      return res.status(400).json(errorResponse('缺少乡镇名称'));
    }

    const existing = await User.findOne({
      where: {
        role: 'rider',
        status: 1,
        rider_kind: 'stationmaster',
        rider_town: town
      }
    });

    if (existing && existing.id !== user.id) {
      return res.status(400).json(errorResponse('该乡镇已绑定站长'));
    }

    await user.update({
      rider_kind: 'stationmaster',
      rider_town: town
    });

    res.json(successResponse({ rider_kind: user.rider_kind, rider_town: user.rider_town }, '绑定成功'));
  } catch (error) {
    next(error);
  }
};

exports.reportLocation = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json(errorResponse('位置参数不正确'));
    }

    await user.update({
      rider_latitude: latitude,
      rider_longitude: longitude,
      rider_location_updated_at: new Date()
    });

    // ==================== 调度大屏同步推送 ====================
    try {
      const socketService = require('../services/socketService');
      const io = socketService.getIO();
      if (io) {
        const cleanData = {
          type: 'location_update',
          vehicleId: String(user.id), // 强制转为字符串，防止前端 substring 报错
          position: [longitude, latitude], // 大屏需要的格式 [lng, lat]
          speed: 0,
          direction: 0,
          status: user.rider_status === 1 ? 'idle' : 'offline', // 简单映射状态
          timestamp: Date.now()
        };
        io.to('dispatcher_room').emit('location_update', cleanData);
      }
    } catch (err) {
      console.error('推送骑手位置到大屏失败:', err);
    }
    // ==========================================================

    res.json(
      successResponse(
        {
          rider_latitude: user.rider_latitude,
          rider_longitude: user.rider_longitude,
          rider_location_updated_at: user.rider_location_updated_at
        },
        '位置更新成功'
      )
    );
  } catch (error) {
    next(error);
  }
};

exports.getOnlineRiderLocations = async (req, res, next) => {
  try {
    const user = req.user;
    if (!['merchant', 'rider'].includes(user.role)) {
      return res.status(403).json(errorResponse('没有权限访问'));
    }

    const minutes = Number(req.query?.minutes || 10);
    const since = new Date(Date.now() - Math.max(1, minutes) * 60 * 1000);

    const riders = await User.findAll({
      where: {
        role: 'rider',
        status: 1,
        rider_status: 1,
        rider_location_updated_at: { [Op.gte]: since }
      },
      attributes: [
        'id',
        'nickname',
        'phone',
        'rider_latitude',
        'rider_longitude',
        'rider_location_updated_at'
      ],
      order: [['rider_location_updated_at', 'DESC']]
    });

    res.json(successResponse(riders));
  } catch (error) {
    next(error);
  }
};

exports.getMyAssignedOrders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const { status } = req.query;
    const where = { rider_id: user.id };
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] }
      ],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

