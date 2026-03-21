const { Order, OrderLog, Merchant, User, sequelize } = require('../models');
const PAYMENT_CONFIG = require('../config/payment');
const { generateOrderNo, successResponse, errorResponse, calculateDistance } = require('../utils/helpers');
const { round2, normalizePayChannel } = require('../utils/payment');
const paymentService = require('../services/paymentService');
const riderDispatchService = require('../services/riderDispatchService');
const dispatchCenterService = require('../services/dispatchCenterService');
const socketService = require('../services/socketService');
const { Op } = require('sequelize');

/**
 * 创建订单（用户端）
 */
exports.createOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      merchant_id,
      type = 'takeout',
      order_type,
      customer_town,
      products_info,
      total_amount,
      delivery_fee = 0,
      package_fee = 0,
      discount_amount = 0,
      delivery_type = 1,
      contact_phone,
      contact_name,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      errand_type,
      errand_description,
      remark
    } = req.body;

    // 参数验证
    if (!merchant_id || !products_info || !total_amount) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }

    // 验证商家是否存在
    const merchant = await Merchant.findByPk(merchant_id);
    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    let computedDeliveryFee = round2(delivery_fee);
    if (Number(delivery_type) === 1 && computedDeliveryFee <= 0) {
      const distanceKm = calculateDistance(
        Number(merchant.latitude),
        Number(merchant.longitude),
        Number(delivery_latitude),
        Number(delivery_longitude)
      );
      if (distanceKm !== null) {
        const pricing = PAYMENT_CONFIG?.businessRules?.deliveryPricing;
        const baseDistanceKm = Number(pricing?.baseDistanceKm ?? 3);
        const baseFee = Number(pricing?.baseFee ?? 2.5);
        const extraPerKm = Number(pricing?.extraPerKm ?? 1);
        const extraKm = Math.max(0, Math.ceil(distanceKm - baseDistanceKm));
        computedDeliveryFee = round2(baseFee + extraKm * extraPerKm);
      }
    }

    const pay_amount = round2(total_amount) + computedDeliveryFee + round2(package_fee) - round2(discount_amount);

    // 生成订单号
    const order_no = generateOrderNo();

    let resolvedOrderType = order_type === 'town' ? 'town' : 'county';
    let resolvedCustomerTown = customer_town;
    if (!resolvedCustomerTown) {
      try {
        const addrObj =
          typeof delivery_address === 'string' ? JSON.parse(delivery_address) : delivery_address;
        resolvedCustomerTown = addrObj?.town || addrObj?.street || addrObj?.district;
      } catch (e) {
        resolvedCustomerTown = undefined;
      }
    }

    // 创建订单
    const order = await Order.create({
      order_no,
      user_id: user.id,
      merchant_id,
      type,
      order_type: resolvedOrderType,
      customer_town: resolvedCustomerTown,
      products_info: typeof products_info === 'object' ? JSON.stringify(products_info) : products_info,
      total_amount,
      delivery_fee: computedDeliveryFee,
      package_fee,
      discount_amount,
      pay_amount,
      delivery_type,
      contact_phone: contact_phone || user.phone,
      contact_name: contact_name || user.nickname,
      delivery_address: typeof delivery_address === 'object' ? JSON.stringify(delivery_address) : delivery_address,
      delivery_latitude,
      delivery_longitude,
      errand_type,
      errand_description,
      remark,
      status: 0 // 待支付
    });

    res.status(201).json(successResponse(order, '订单创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 支付订单（用户端）
 */
exports.payOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.body?.order_id || req.body?.orderId || req.body?.orderID || req.body?.id;
    const channel = normalizePayChannel(req.body?.channel || req.body?.payMethod || req.body?.pay_method);

    const order = await Order.findOne({
      where: { id: orderId, user_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 0) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const tx = await paymentService.createPrepay({
      order,
      channel,
      requestPayload: { source: 'order.pay', user_id: user.id, channel }
    });

    const mode = process.env.PAYMENT_MODE || 'mock';
    if (mode === 'mock' || channel === 'mock' || channel === 'balance') {
      const { tx: paidTx, order: paidOrder } = await paymentService.confirmSuccess({
        outTradeNo: tx.out_trade_no,
        tradeNo: `LEGACY-${Date.now()}`,
        notifyId: `LEGACY-NOTIFY-${Date.now()}`,
        amount: tx.amount,
        notifyPayload: { source: 'order.pay', user_id: user.id, channel },
        channel
      });
      
      const merchant = await Merchant.findByPk(paidOrder.merchant_id);
      if (merchant && merchant.user_id) {
        socketService.notifyMerchantNewOrder(merchant.user_id, paidOrder);
      }
      
      return res.json(successResponse({ order: paidOrder, transaction: paidTx }, '支付成功'));
    }

    res.json(
      successResponse(
        {
          order_id: order.id,
          out_trade_no: tx.out_trade_no,
          amount: round2(tx.amount),
          channel: tx.channel,
          mode
        },
        '预下单成功'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的订单（用户端）
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const user = req.user;
    const { status, type } = req.query;

    const where = { user_id: user.id };
    if (status) where.status = status;
    if (type) where.type = type;

    const orders = await Order.findAll({
      where,
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'logo', 'phone', 'address']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone', 'avatar']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取订单详情
 */
exports.getOrderDetail = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id },
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'logo', 'phone', 'address']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone', 'avatar']
      }, {
        model: OrderLog,
        as: 'logs',
        order: [['id', 'DESC']]
      }]
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    // 验证权限
    if (order.user_id !== user.id && order.merchant_id !== user.id && order.rider_id !== user.id) {
      return res.status(403).json(errorResponse('没有权限查看'));
    }

    res.json(successResponse(order));
  } catch (error) {
    next(error);
  }
};

/**
 * 取消订单（用户端）
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, reason } = req.body;

    const order = await Order.findOne({
      where: { id: order_id, user_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (![0, 1].includes(order.status)) {
      return res.status(400).json(errorResponse('当前状态不能取消'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 7,
      cancel_reason: reason
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'user',
      action: '取消订单',
      from_status: fromStatus,
      to_status: 7,
      remark: reason
    });

    res.json(successResponse(order, '订单已取消'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家接单
 */
exports.acceptOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 1) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 2,
      accepted_at: new Date()
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '接单',
      from_status: fromStatus,
      to_status: 2,
      remark: '商家已接单'
    });

    socketService.notifyUserOrderUpdate(order.user_id, order, '商家已接单，正在备餐中');

    res.json(successResponse(order, '已接单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家拒单
 */
exports.rejectOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id, reason } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 1) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 7,
      cancel_reason: reason
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: '拒单',
      from_status: fromStatus,
      to_status: 7,
      remark: reason
    });

    res.json(successResponse(order, '已拒单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家备货完成
 */
exports.prepareOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (![2, 3].includes(order.status)) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    const nextStatus = order.status === 2 ? 3 : 4;
    await order.update({ status: nextStatus });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: nextStatus === 3 ? '开始备货' : '备货完成',
      from_status: fromStatus,
      to_status: nextStatus,
      remark: nextStatus === 3 ? '商家开始备货' : '商家已备货完成'
    });

    res.json(successResponse(order, nextStatus === 3 ? '开始备货' : '备货完成'));
  } catch (error) {
    next(error);
  }
};


/**
 * 骑手确认送达
 */
exports.confirmDelivery = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以确认送达'));
    }

    const order = await Order.findOne({
      where: { id: order_id, rider_id: user.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 5) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    await sequelize.transaction(async (t) => {
      const fromStatus = order.status;
      await order.update(
        {
          status: 6,
          delivered_at: new Date(),
          settled_at: new Date()
        },
        { transaction: t }
      );

      await user.increment('rider_balance', { by: Number(order.rider_fee || 0), transaction: t });

      const merchant = await Merchant.findByPk(order.merchant_id, { transaction: t });
      if (merchant) {
        const merchantIncome = Number(order.merchant_income_amount || 0);
        if (merchantIncome > 0) {
          await merchant.increment(
            { balance: merchantIncome, total_income: merchantIncome },
            { transaction: t }
          );
        }
      }

      await OrderLog.create(
        {
          order_id: order.id,
          operator_id: user.id,
          operator_type: 'rider',
          action: '确认送达',
          from_status: fromStatus,
          to_status: 6,
          remark: '骑手已送达'
        },
        { transaction: t }
      );
    });

    const refreshed = await Order.findByPk(order.id);
    socketService.notifyUserOrderUpdate(order.user_id, refreshed, '订单已送达');
    res.json(successResponse(refreshed, '送达成功'));
  } catch (error) {
    next(error);
  }
};

exports.getAvailableOrders = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以查看'));
    }

    const orders = await Order.findAll({
      where: {
        rider_id: user.id,
        status: { [Op.in]: [5, 6] }
      },
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
        { model: User, as: 'user', attributes: ['nickname', 'phone'] }
      ],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的配送订单（骑手端）
 */
exports.getRiderOrders = async (req, res, next) => {
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
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['name', 'address', 'phone']
      }, {
        model: User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新骑手状态（接单中/休息）
 */
exports.updateRiderStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const { status } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以操作'));
    }

    await user.update({
      rider_status: status ? 1 : 0
    });

    res.json(successResponse({
      rider_status: status ? 1 : 0
    }, '状态更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家发货（配送中）
 */
exports.deliverOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const merchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const order = await Order.findOne({
      where: { id: order_id, merchant_id: merchant.id }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 4) {
      return res.status(400).json(errorResponse('订单状态不正确，需要先备货完成'));
    }

    if (order.rider_id) {
      return res.status(400).json(errorResponse('订单已分配骑手'));
    }

    if (order.order_type === 'county') {
      if (!order.customer_town) {
        return res.status(400).json(errorResponse('县城外卖订单缺少客户乡镇'));
      }

      await dispatchCenterService.pushOrderToDispatchCenter({ order, merchant });

      await order.update({
        dispatch_center_status: 'sent',
        dispatch_center_order_id: String(order.id),
        dispatch_sent_at: new Date()
      });

      await OrderLog.create({
        order_id: order.id,
        operator_id: user.id,
        operator_type: 'merchant',
        action: '提交调度中心',
        from_status: 4,
        to_status: 4,
        remark: '县城外卖已提交调度中心派单'
      });

      return res.json(successResponse(order, '已提交调度中心'));
    }

    let rider = null;
    if (order.order_type === 'town' && order.customer_town) {
      rider = await User.findOne({
        where: {
          role: 'rider',
          status: 1,
          rider_kind: 'stationmaster',
          rider_town: order.customer_town
        }
      });
    }

    if (!rider) {
      rider = await riderDispatchService.selectRiderForMerchant(merchant);
    }

    if (!rider) {
      return res.status(400).json(errorResponse('暂无可用骑手'));
    }

    const fromStatus = order.status;
    await order.update({
      rider_id: rider.id,
      status: 5
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'merchant',
      action: order.order_type === 'town' ? '分配站长' : '分配骑手',
      from_status: fromStatus,
      to_status: 5,
      remark: `已分配：${rider.nickname || rider.phone || rider.id}`
    });

    const refreshed = await Order.findByPk(order.id, {
      include: [
        { model: Merchant, as: 'merchant', attributes: ['name', 'address', 'phone'] },
        { model: User, as: 'rider', attributes: ['nickname', 'phone'] }
      ]
    });

    socketService.notifyRiderNewOrder(rider.id, refreshed);
    socketService.notifyUserOrderUpdate(order.user_id, refreshed, '骑手已接单，正在配送中');

    res.json(successResponse(refreshed, '已派单'));
  } catch (error) {
    next(error);
  }
};

/**
 * 发布跑腿订单
 */
exports.publishErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      pickup_address,
      delivery_address,
      item_type,
      expected_time,
      reward,
      remark
    } = req.body;

    // 生成订单号
    const order_no = generateOrderNo();

    const order = await Order.create({
      order_no,
      user_id: user.id,
      type: 'errand',
      status: 1, // 待接单
      errand_type: item_type,
      errand_description: remark,
      delivery_address: JSON.stringify(delivery_address),
      rider_fee: reward || 0,
      pay_amount: reward || 0,
      remark: `取件地址: ${pickup_address}, 期望送达: ${expected_time}`
    });

    res.status(201).json(successResponse(order, '跑腿订单发布成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取跑腿订单列表
 */
exports.getErrandList = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const where = { type: 'errand' };
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }, {
        model: User,
        as: 'rider',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 骑手接跑腿订单
 */
exports.acceptErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    if (user.role !== 'rider') {
      return res.status(403).json(errorResponse('只有骑手可以接单'));
    }

    const order = await Order.findOne({
      where: { id: order_id, type: 'errand' }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 1) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      rider_id: user.id,
      status: 5 // 配送中
    });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'rider',
      action: '接跑腿订单',
      from_status: fromStatus,
      to_status: 5,
      remark: '骑手已接单'
    });

    res.json(successResponse(order, '接单成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 完成跑腿订单
 */
exports.completeErrand = async (req, res, next) => {
  try {
    const user = req.user;
    const { order_id } = req.body;

    const order = await Order.findOne({
      where: { id: order_id, rider_id: user.id, type: 'errand' }
    });

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 5) {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    const fromStatus = order.status;
    await order.update({
      status: 6, // 已完成
      delivered_at: new Date()
    });

    // 更新骑手余额
    await user.increment('rider_balance', { by: order.rider_fee || 0 });

    // 记录日志
    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'rider',
      action: '完成跑腿订单',
      from_status: fromStatus,
      to_status: 6,
      remark: '跑腿订单已完成'
    });

    res.json(successResponse(order, '订单已完成'));
  } catch (error) {
    next(error);
  }
};
