const { User, Order, Merchant, ServiceArea } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

const resolveRiderScope = (user) => {
  if (user.delivery_scope === 'town_delivery') {
    return {
      delivery_scope: 'town_delivery',
      town_name: user.town_name || user.rider_town || null
    };
  }

  if (user.delivery_scope === 'county_delivery') {
    return {
      delivery_scope: 'county_delivery',
      town_name: null
    };
  }

  if (user.rider_kind === 'stationmaster' || user.rider_town) {
    return {
      delivery_scope: 'town_delivery',
      town_name: user.town_name || user.rider_town || null
    };
  }

  return {
    delivery_scope: 'county_delivery',
    town_name: null
  };
};

const buildRiderOwnedOrderWhere = (user) => {
  const scope = resolveRiderScope(user);
  const where = { rider_id: user.id };

  if (scope.delivery_scope === 'town_delivery') {
    where.order_type = 'town';
    if (scope.town_name) {
      where.customer_town = scope.town_name;
    }
    return where;
  }

  where.order_type = 'county';
  return where;
};

const resolveTownArea = async (payload = {}) => {
  const townCode = String(payload.town_code || payload.townCode || '').trim();
  const townName = String(payload.town || payload.town_name || payload.townName || '').trim();

  if (townCode) {
    return ServiceArea.findOne({
      where: {
        area_code: townCode,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  if (townName) {
    return ServiceArea.findOne({
      where: {
        area_name: townName,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  return null;
};

exports.bindStationTown = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    const townArea = await resolveTownArea(req.body);
    if (!townArea) {
      return res.status(400).json(errorResponse('缺少有效乡镇'));
    }

    const existing = await User.findOne({
      where: {
        role: 'rider',
        status: 1,
        rider_level: 'captain',
        town_code: townArea.area_code
      }
    });

    if (existing && existing.id !== user.id) {
      return res.status(400).json(errorResponse('该乡镇已绑定站长'));
    }

    await user.update({
      delivery_scope: 'town_delivery',
      rider_level: 'captain',
      town_code: townArea.area_code,
      town_name: townArea.area_name,
      rider_kind: 'stationmaster',
      rider_town: townArea.area_name
    });

    res.json(successResponse({
      delivery_scope: user.delivery_scope,
      rider_level: user.rider_level,
      town_code: user.town_code,
      town_name: user.town_name,
      rider_kind: user.rider_kind,
      rider_town: user.rider_town
    }, '绑定成功'));
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
    const where = {
      role: 'rider',
      status: 1,
      rider_status: 1,
      rider_location_updated_at: { [Op.gte]: since }
    };

    if (user.role === 'merchant') {
      const merchant = await Merchant.findOne({ where: { user_id: user.id } });
      if (!merchant) {
        return res.status(404).json(errorResponse('您还没有店铺'));
      }

      if (merchant.business_scope === 'town_food') {
        where.delivery_scope = 'town_delivery';
        if (merchant.town_name) {
          where.town_name = merchant.town_name;
        }
      } else if (merchant.business_scope === 'county_food') {
        where.delivery_scope = 'county_delivery';
      }
    } else {
      const scope = resolveRiderScope(user);
      if (scope.delivery_scope === 'town_delivery') {
        where.delivery_scope = 'town_delivery';
        if (scope.town_name) {
          where.town_name = scope.town_name;
        }
      } else {
        where.delivery_scope = 'county_delivery';
      }
    }

    const riders = await User.findAll({
      where,
      attributes: [
        'id',
        'nickname',
        'phone',
        'delivery_scope',
        'town_code',
        'town_name',
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
    const where = buildRiderOwnedOrderWhere(user);
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone', 'longitude', 'latitude'] }
      ],
      order: [['id', 'DESC']]
    });

    const normalized = orders.map((o) => {
      const plain = o.get({ plain: true });
      return {
        ...plain,
        merchantLng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchantLat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        merchant_lng: Number(plain.merchant_lng || plain.merchant?.longitude || 0) || null,
        merchant_lat: Number(plain.merchant_lat || plain.merchant?.latitude || 0) || null,
        customer_lng: Number(plain.customer_lng || plain.delivery_longitude || 0) || null,
        customer_lat: Number(plain.customer_lat || plain.delivery_latitude || 0) || null,
        longitude: Number(plain.customer_lng || plain.delivery_longitude || 0) || null,
        latitude: Number(plain.customer_lat || plain.delivery_latitude || 0) || null,
      };
    });

    res.json(successResponse(normalized));
  } catch (error) {
    next(error);
  }
};
