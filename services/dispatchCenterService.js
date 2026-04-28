const axios = require('axios');
const { Op } = require('sequelize');
const { Order, OrderLog, User, Merchant } = require('../models');
const socketService = require('./socketService');

const buildDispatchOrderPayload = ({ order, merchant }) => {
  return {
    id: String(order.id),
    restaurant: merchant?.name || '',
    restaurant_lat: merchant?.latitude ?? null,
    restaurant_lon: merchant?.longitude ?? null,
    customer_town: order.customer_town || '',
    // 兼容前端可能传入的 customer_lat 和 delivery_latitude
    customer_lat: order.customer_lat ?? order.delivery_latitude ?? null,
    customer_lon: order.customer_lng ?? order.delivery_longitude ?? null,
    order_type: order.order_type || 'county',
    products_info: order.products_info || '[]' // 确保商品信息推给调度中心
  };
};

const pushOrderToDispatchCenter = async ({ order, merchant }) => {
  const baseUrl = process.env.DISPATCH_CENTER_BASE_URL;
  if (!baseUrl) {
    const err = new Error('未配置调度中心地址');
    err.statusCode = 500;
    throw err;
  }

  const payload = buildDispatchOrderPayload({ order, merchant });
  if (!payload.restaurant || !payload.customer_town) {
    const err = new Error('推送调度中心缺少必要字段');
    err.statusCode = 400;
    throw err;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/orders`;
  const timeoutMs = Number(process.env.DISPATCH_CENTER_TIMEOUT_MS || 5000);

  const res = await axios.post(url, payload, {
    timeout: timeoutMs
  });

  return res.data;
};

const findTownStationmaster = async (townName) => {
  const resolvedTownName = String(townName || '').trim();
  if (!resolvedTownName) {
    return null;
  }

  return User.findOne({
    where: {
      role: 'rider',
      status: 1,
      delivery_scope: 'town_delivery',
      rider_level: 'captain',
      [Op.or]: [
        { town_name: resolvedTownName },
        { rider_town: resolvedTownName }
      ]
    },
    order: [['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
  });
};

const assignToTownStation = async ({ order, merchant, operatorUserId }) => {
  const targetOrder = order?.id
    ? order
    : await Order.findByPk(order, {
        include: [
          { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone', 'town_name'] },
          { model: User, as: 'rider', attributes: ['nickname', 'phone'] }
        ]
      });

  if (!targetOrder) {
    const err = new Error('订单不存在');
    err.statusCode = 404;
    throw err;
  }

  const resolvedMerchant =
    merchant ||
    targetOrder.merchant ||
    (await Merchant.findByPk(targetOrder.merchant_id, {
      attributes: ['id', 'name', 'address', 'phone', 'town_name']
    }));

  const stationTownName = String(targetOrder.customer_town || resolvedMerchant?.town_name || '').trim();
  if (!stationTownName) {
    const err = new Error('乡镇订单缺少乡镇归属，无法分配站长');
    err.statusCode = 400;
    throw err;
  }

  const rider = await findTownStationmaster(stationTownName);
  if (!rider) {
    const err = new Error(`未找到【${stationTownName}】站长`);
    err.statusCode = 400;
    throw err;
  }

  const fromStatus = Number(targetOrder.status);
  await targetOrder.update({
    rider_id: rider.id,
    status: 4,
    dispatch_center_status: 'station_assigned'
  });

  await OrderLog.create({
    order_id: targetOrder.id,
    operator_id: operatorUserId || resolvedMerchant?.user_id || null,
    operator_type: 'merchant',
    action: '自动分配站长',
    from_status: fromStatus,
    to_status: 4,
    remark: `已分配给【${stationTownName}】站长：${rider.nickname || rider.phone || rider.id}`
  });

  const refreshed = await Order.findByPk(targetOrder.id, {
    include: [
      { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone', 'town_name'] },
      { model: User, as: 'rider', attributes: ['nickname', 'phone', 'avatar'] }
    ]
  });

  socketService.notifyRiderNewOrder(rider.id, refreshed);
  socketService.notifyUserOrderUpdate(targetOrder.user_id, refreshed, '乡镇站长已接单，等待取餐配送');
  await socketService.broadcastDispatcherOrdersUpdate();

  return {
    rider,
    order: refreshed
  };
};

module.exports = {
  pushOrderToDispatchCenter,
  assignToTownStation
};
