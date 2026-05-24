// 这个文件是“调度中心服务”。
// 主要负责两件事：
// 1. 把订单推给外部调度中心
// 2. 把乡镇订单自动分配给对应乡镇站长
const axios = require('axios');
const { Op } = require('sequelize');
const { Order, OrderLog, User, Merchant } = require('../models');
const socketService = require('./socketService');

// 把订单整理成调度中心接口需要的 payload 结构。
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

// 向外部调度中心推单。
// 这里会先检查环境变量里有没有配置调度中心地址，再真正发 HTTP 请求。
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

// 根据乡镇名称查当前可接单的乡镇站长。
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

// 把乡镇订单自动分配给乡镇站长。
// 这里除了改订单归属，还会写订单日志、发 socket 通知。
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
    dispatch_center_status: 'station_assigned',
    current_responsible_user_id: rider.id,
    current_responsible_role: 'town_stationmaster'
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

  socketService.notifyRiderNewOrder(rider.id, refreshed, {
    eventType: 'rider_station_order_assigned',
    title: '乡镇待配送订单',
    message: '您有新的乡镇待配送订单',
    speechText: '您有新的乡镇待配送订单，请及时处理',
    soundType: 'rider_new_delivery',
    priority: 'high',
    jumpPath: '/pages/orders/index',
    dedupeKey: `rider_station_order_assigned:${targetOrder.id}:${rider.id}`
  });
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
