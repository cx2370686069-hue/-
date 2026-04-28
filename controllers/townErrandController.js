const { Op } = require('sequelize');
const {
  User,
  Merchant,
  Order,
  OrderLog,
  TownErrandConversation,
  TownErrandMessage
} = require('../models');
const { successResponse, errorResponse, generateOrderNo } = require('../utils/helpers');
const socketService = require('../services/socketService');
const dispatchCenterService = require('../services/dispatchCenterService');

const MAX_MESSAGE_LENGTH = 500;

const normalizeTownName = (value) => String(value || '').trim();
const normalizeMessageContent = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_MESSAGE_LENGTH);
const normalizeText = (value, maxLength = 255) => String(value || '').trim().slice(0, maxLength);
const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const round2 = (value) => Number(Number(value || 0).toFixed(2));
const isPositiveAmount = (value) => Number.isFinite(value) && value > 0;

const isTownStationmaster = (user) => {
  if (!user) {
    return false;
  }
  return (
    user.role === 'rider' &&
    user.status === 1 &&
    user.delivery_scope === 'town_delivery' &&
    (user.rider_kind === 'stationmaster' || user.rider_level === 'captain')
  );
};

const buildConversationWhereForUser = (user) => {
  if (user.role === 'user') {
    return { user_id: user.id };
  }

  if (isTownStationmaster(user)) {
    return { stationmaster_id: user.id };
  }

  return null;
};

const buildConversationSummary = async (conversation, currentUserId) => {
  const unreadWhere = {
    conversation_id: conversation.id,
    is_read: false,
    sender_id: { [Op.ne]: currentUserId }
  };

  const unread_count = await TownErrandMessage.count({ where: unreadWhere });

  return {
    id: conversation.id,
    conversation_id: conversation.id,
    conversationId: conversation.id,
    town_name: conversation.town_name,
    status: conversation.status,
    user_id: conversation.user_id,
    stationmaster_id: conversation.stationmaster_id,
    last_message: conversation.last_message || '',
    lastMessage: conversation.last_message || '',
    last_message_sender_type: conversation.last_message_sender_type || null,
    last_message_at: conversation.last_message_at,
    lastMessageAt: conversation.last_message_at,
    unread_count,
    unreadCount: unread_count,
    stationmaster: conversation.stationmaster
      ? {
          id: conversation.stationmaster.id,
          nickname: conversation.stationmaster.nickname || '',
          phone: conversation.stationmaster.phone || '',
          avatar: conversation.stationmaster.avatar || '',
          town_name: conversation.stationmaster.town_name || conversation.stationmaster.rider_town || conversation.town_name
        }
      : null,
    stationmaster_name: conversation.stationmaster?.nickname || '',
    stationmaster_avatar: conversation.stationmaster?.avatar || '',
    stationmaster_phone: conversation.stationmaster?.phone || ''
  };
};

const ensureConversationParticipant = (conversation, user) => {
  if (!conversation || !user) {
    return false;
  }
  return Number(conversation.user_id) === Number(user.id) || Number(conversation.stationmaster_id) === Number(user.id);
};

const findTownStationmaster = async (townName) => {
  return User.findOne({
    where: {
      role: 'rider',
      status: 1,
      delivery_scope: 'town_delivery',
      rider_level: 'captain',
      [Op.or]: [
        { town_name: townName },
        { rider_town: townName }
      ]
    },
    attributes: ['id', 'nickname', 'phone', 'avatar', 'town_name', 'rider_town'],
    order: [['rider_location_updated_at', 'DESC'], ['id', 'DESC']]
  });
};

const findTownErrandMerchant = async (townName) => {
  return Merchant.findOne({
    where: {
      status: 1,
      audit_status: 1,
      business_scope: 'town_food',
      town_name: townName
    },
    attributes: ['id', 'name', 'address', 'phone', 'latitude', 'longitude', 'town_name', 'user_id'],
    order: [['id', 'ASC']]
  });
};

const buildAddressPayload = ({ text, lng, lat, townName, fallbackLabel }) => {
  const detail = normalizeText(text, 255);
  const normalizedTown = normalizeTownName(townName);
  return {
    town_name: normalizedTown || null,
    address: detail || null,
    detail: detail || null,
    label: detail || `${normalizedTown}${fallbackLabel}`,
    longitude: lng,
    latitude: lat
  };
};

const buildOrderAddressText = ({ deliveryAddressText, pickupAddressText, townName }) => {
  const delivery = normalizeText(deliveryAddressText, 200);
  const pickup = normalizeText(pickupAddressText, 200);
  const town = normalizeTownName(townName);
  return delivery || pickup || `${town}地址待沟通`;
};

const buildTownErrandRemark = ({ pickupAddressText, deliveryAddressText, amount }) => {
  const parts = [];
  if (pickupAddressText) {
    parts.push(`取件地址: ${pickupAddressText}`);
  }
  if (deliveryAddressText) {
    parts.push(`收货地址: ${deliveryAddressText}`);
  }
  if (isPositiveAmount(amount)) {
    parts.push(`协商金额: ${round2(amount)}元`);
  }
  return parts.join('；') || '乡镇跑腿代购';
};

exports.getTownErrandStationmaster = async (req, res, next) => {
  try {
    const townName = normalizeTownName(req.query.town_name || req.query.townName);
    if (!townName) {
      return res.status(400).json(errorResponse('缺少乡镇名称'));
    }

    const stationmaster = await findTownStationmaster(townName);

    if (!stationmaster) {
      return res.status(404).json(errorResponse(`当前乡镇【${townName}】暂无可联系站长`));
    }

    res.json(successResponse({
      id: stationmaster.id,
      nickname: stationmaster.nickname || '',
      phone: stationmaster.phone || '',
      avatar: stationmaster.avatar || '',
      town_name: stationmaster.town_name || stationmaster.rider_town || townName
    }));
  } catch (error) {
    next(error);
  }
};

exports.openTownErrandConversation = async (req, res, next) => {
  try {
    const user = req.user;
    const townName = normalizeTownName(req.body.town_name || req.body.townName);

    if (!townName) {
      return res.status(400).json(errorResponse('缺少乡镇名称'));
    }

    const stationmaster = await findTownStationmaster(townName);

    if (!stationmaster) {
      return res.status(404).json(errorResponse(`当前乡镇【${townName}】暂无可联系站长`));
    }

    const [conversation] = await TownErrandConversation.findOrCreate({
      where: {
        user_id: user.id,
        stationmaster_id: stationmaster.id,
        town_name: townName
      },
      defaults: {
        status: 'active'
      }
    });

    const summary = await buildConversationSummary({
      ...conversation.toJSON(),
      stationmaster
    }, user.id);

    res.json(successResponse(summary, '联系站长会话已就绪'));
  } catch (error) {
    next(error);
  }
};

exports.getTownErrandConversations = async (req, res, next) => {
  try {
    const user = req.user;
    const where = buildConversationWhereForUser(user);
    if (!where) {
      return res.status(403).json(errorResponse('当前角色无权查看跑腿代购消息'));
    }

    const conversations = await TownErrandConversation.findAll({
      where,
      include: [
        {
          model: User,
          as: 'stationmaster',
          attributes: ['id', 'nickname', 'phone', 'avatar', 'town_name', 'rider_town']
        }
      ],
      order: [['last_message_at', 'DESC'], ['updated_at', 'DESC'], ['id', 'DESC']]
    });

    const list = [];
    for (const item of conversations) {
      list.push(await buildConversationSummary(item, user.id));
    }

    res.json(successResponse(list));
  } catch (error) {
    next(error);
  }
};

exports.getTownErrandMessages = async (req, res, next) => {
  try {
    const user = req.user;
    const conversationId = Number(req.params.id);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json(errorResponse('会话ID不正确'));
    }

    const conversation = await TownErrandConversation.findByPk(conversationId);
    if (!conversation || !ensureConversationParticipant(conversation, user)) {
      return res.status(404).json(errorResponse('会话不存在'));
    }

    await TownErrandMessage.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          conversation_id: conversationId,
          is_read: false,
          sender_id: { [Op.ne]: user.id }
        }
      }
    );

    const messages = await TownErrandMessage.findAll({
      where: { conversation_id: conversationId },
      order: [['id', 'ASC']]
    });

    res.json(successResponse(messages.map((item) => ({
      id: item.id,
      conversation_id: item.conversation_id,
      sender_id: item.sender_id,
      sender_type: item.sender_type,
      content: item.content,
      is_read: Boolean(item.is_read),
      read_at: item.read_at,
      created_at: item.created_at
    }))));
  } catch (error) {
    next(error);
  }
};

exports.sendTownErrandMessage = async (req, res, next) => {
  try {
    const user = req.user;
    const conversationId = Number(req.params.id);
    const content = normalizeMessageContent(req.body.content);

    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json(errorResponse('会话ID不正确'));
    }
    if (!content) {
      return res.status(400).json(errorResponse('消息内容不能为空'));
    }

    const conversation = await TownErrandConversation.findByPk(conversationId, {
      include: [
        {
          model: User,
          as: 'stationmaster',
          attributes: ['id', 'nickname', 'phone', 'avatar', 'town_name', 'rider_town']
        }
      ]
    });
    if (!conversation || !ensureConversationParticipant(conversation, user)) {
      return res.status(404).json(errorResponse('会话不存在'));
    }
    if (conversation.status !== 'active') {
      return res.status(400).json(errorResponse('当前会话已关闭'));
    }

    const senderType = Number(conversation.user_id) === Number(user.id) ? 'user' : 'stationmaster';
    const targetUserId = senderType === 'user' ? conversation.stationmaster_id : conversation.user_id;

    const message = await TownErrandMessage.create({
      conversation_id: conversation.id,
      sender_id: user.id,
      sender_type: senderType,
      content
    });

    await conversation.update({
      last_message: content,
      last_message_sender_type: senderType,
      last_message_at: message.created_at || new Date()
    });

    const payload = {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      sender_type: message.sender_type,
      content: message.content,
      is_read: Boolean(message.is_read),
      read_at: message.read_at,
      created_at: message.created_at
    };

    if (senderType === 'user') {
      socketService.emitToRider(targetUserId, 'town_errand_message', {
        type: 'town_errand_message',
        conversation_id: conversation.id,
        town_name: conversation.town_name,
        data: payload
      });
    } else {
      socketService.emitToUser(targetUserId, 'town_errand_message', {
        type: 'town_errand_message',
        conversation_id: conversation.id,
        town_name: conversation.town_name,
        data: payload
      });
    }

    res.status(201).json(successResponse(payload, '发送成功'));
  } catch (error) {
    next(error);
  }
};

exports.createTownErrandOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const townName = normalizeTownName(req.body.town_name || req.body.townName);
    const amount = round2(req.body.amount ?? req.body.reward ?? req.body.pay_amount);
    const pickupAddressText = normalizeText(
      req.body.pickup_address ||
      req.body.pickupAddress ||
      req.body.pickup_address_text ||
      req.body.pickupAddressText,
      255
    );
    const deliveryAddressText = normalizeText(
      req.body.delivery_address ||
      req.body.deliveryAddress ||
      req.body.delivery_address_text ||
      req.body.deliveryAddressText,
      255
    );
    const pickupLng = normalizeOptionalNumber(req.body.pickup_lng ?? req.body.pickupLng ?? req.body.pickup_longitude ?? req.body.pickupLongitude);
    const pickupLat = normalizeOptionalNumber(req.body.pickup_lat ?? req.body.pickupLat ?? req.body.pickup_latitude ?? req.body.pickupLatitude);
    const deliveryLng = normalizeOptionalNumber(req.body.delivery_lng ?? req.body.deliveryLng ?? req.body.delivery_longitude ?? req.body.deliveryLongitude);
    const deliveryLat = normalizeOptionalNumber(req.body.delivery_lat ?? req.body.deliveryLat ?? req.body.delivery_latitude ?? req.body.deliveryLatitude);

    if (!townName) {
      return res.status(400).json(errorResponse('缺少乡镇名称'));
    }
    if (!isPositiveAmount(amount)) {
      return res.status(400).json(errorResponse('金额必须大于0'));
    }

    const [stationmaster, merchant] = await Promise.all([
      findTownStationmaster(townName),
      findTownErrandMerchant(townName)
    ]);

    if (!stationmaster) {
      return res.status(400).json(errorResponse(`当前乡镇【${townName}】暂无可接单站长`));
    }
    if (!merchant) {
      return res.status(400).json(errorResponse(`当前乡镇【${townName}】暂无可用于落单的镇上店铺数据`));
    }

    const orderNo = generateOrderNo();
    const pickupAddressPayload = buildAddressPayload({
      text: pickupAddressText,
      lng: pickupLng,
      lat: pickupLat,
      townName,
      fallbackLabel: '取件地址待沟通'
    });
    const deliveryAddressPayload = buildAddressPayload({
      text: deliveryAddressText,
      lng: deliveryLng,
      lat: deliveryLat,
      townName,
      fallbackLabel: '收货地址待沟通'
    });
    const addressText = buildOrderAddressText({ deliveryAddressText, pickupAddressText, townName });
    const orderRemark = buildTownErrandRemark({ pickupAddressText, deliveryAddressText, amount });
    const itemPayload = [{
      type: 'town_errand',
      name: '乡镇跑腿代购',
      town_name: townName,
      pickup_address: pickupAddressPayload.detail,
      delivery_address: deliveryAddressPayload.detail,
      amount
    }];

    let order = await Order.create({
      order_no: orderNo,
      order_id: orderNo,
      user_id: user.id,
      merchant_id: merchant.id,
      type: 'errand',
      order_type: 'town',
      customer_town: townName,
      status: 1,
      dispatch_center_status: 'station_pending',
      products_info: itemPayload,
      items_json: itemPayload,
      total_amount: amount,
      pay_amount: amount,
      total_price: amount,
      rider_fee: amount,
      delivery_fee: 0,
      package_fee: 0,
      discount_amount: 0,
      delivery_type: 1,
      address: addressText,
      delivery_address: deliveryAddressPayload,
      delivery_longitude: deliveryLng,
      delivery_latitude: deliveryLat,
      customer_lng: deliveryLng,
      customer_lat: deliveryLat,
      merchant_lng: merchant.longitude,
      merchant_lat: merchant.latitude,
      contact_name: normalizeText(user.nickname || '用户', 50),
      contact_phone: normalizeText(user.phone, 20),
      errand_type: '乡镇跑腿代购',
      errand_description: JSON.stringify({
        town_name: townName,
        pickup_address: pickupAddressPayload,
        delivery_address: deliveryAddressPayload
      }),
      remark: orderRemark,
      paid_at: new Date(),
      payment_channel: 'mock',
      accepted_at: new Date()
    });

    await OrderLog.create({
      order_id: order.id,
      operator_id: user.id,
      operator_type: 'user',
      action: '创建乡镇跑腿代购订单',
      from_status: 0,
      to_status: 1,
      remark: `乡镇：${townName}`
    });

    try {
      const assigned = await dispatchCenterService.assignToTownStation({
        order,
        merchant,
        operatorUserId: user.id
      });
      if (assigned?.order) {
        order = assigned.order;
      }
    } catch (assignError) {
      return next(assignError);
    }

    const refreshedOrder = order?.id
      ? order
      : await Order.findByPk(order.id);

    res.status(201).json(successResponse({
      id: refreshedOrder.id,
      order_no: refreshedOrder.order_no,
      status: refreshedOrder.status,
      type: refreshedOrder.type,
      order_type: refreshedOrder.order_type,
      customer_town: refreshedOrder.customer_town,
      rider_id: refreshedOrder.rider_id,
      pay_amount: refreshedOrder.pay_amount,
      address: refreshedOrder.address
    }, '乡镇跑腿代购订单创建成功'));
  } catch (error) {
    next(error);
  }
};
