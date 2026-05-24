const { calculateDistance } = require('../../../../utils/helpers');
const {
  DELIVERY_CONFIRM_DISTANCE_LIMIT_KM,
  DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED,
  createDeliveryError
} = require('../shared/constants');
const {
  canCompleteDeliveryTransition
} = require('../shared/state-machine');
const {
  buildDeliveryLogPayload
} = require('../shared/log-policy');

// 这个文件专门管“确认送达前的准备逻辑”。
// 真正更新订单状态的动作不在这里做，这里只负责把能不能送达、送达后该记什么日志先准备好。
const hasValidRouteCoordinatePair = (latitude, longitude) =>
  Number.isFinite(Number(latitude)) &&
  Number.isFinite(Number(longitude)) &&
  Math.abs(Number(latitude)) > 0 &&
  Math.abs(Number(longitude)) > 0;

// 如果以后要重新开启“必须靠近客户位置才能点送达”，核心拦截逻辑就在这里。
const assertWithinDeliveryConfirmDistance = ({
  actorLat,
  actorLng,
  customerLat,
  customerLng,
  actorLabel = '配送员'
} = {}) => {
  if (!DELIVERY_CONFIRM_DISTANCE_CHECK_ENABLED) {
    return;
  }
  if (!hasValidRouteCoordinatePair(actorLat, actorLng)) {
    throw createDeliveryError(`${actorLabel}定位未就绪，暂时不能确认送达`);
  }
  if (!hasValidRouteCoordinatePair(customerLat, customerLng)) {
    throw createDeliveryError('用户坐标缺失，暂时不能确认送达');
  }

  const distanceKm = calculateDistance(actorLat, actorLng, customerLat, customerLng);
  if (!Number.isFinite(distanceKm)) {
    throw createDeliveryError('距离计算失败，请稍后重试');
  }
  if (distanceKm > DELIVERY_CONFIRM_DISTANCE_LIMIT_KM) {
    throw createDeliveryError(`距用户约${Math.round(distanceKm * 1000)}米，需在800米内才能确认送达`);
  }
};

// ==================== 商家自配送送达区 ====================
const prepareMerchantSelfDeliveryCompletion = ({
  order = {},
  user = {},
  latestActor = null,
  isMerchantDeliveryOperator = false
} = {}) => {
  if (!canCompleteDeliveryTransition(order)) {
    throw createDeliveryError('当前订单还未进入店铺配送中状态');
  }

  if (
    isMerchantDeliveryOperator &&
    (
      (Number(order.rider_id || 0) > 0 && Number(order.rider_id) !== Number(user.id || 0)) ||
      (
        Number(order.current_responsible_user_id || 0) > 0 &&
        Number(order.current_responsible_user_id) !== Number(user.id || 0)
      )
    )
  ) {
    throw createDeliveryError('该订单已由其他自配送员负责', 403);
  }

  if (isMerchantDeliveryOperator) {
    assertWithinDeliveryConfirmDistance({
      actorLat: latestActor?.rider_latitude,
      actorLng: latestActor?.rider_longitude,
      customerLat: Number(order.customer_lat || order.delivery_latitude || 0),
      customerLng: Number(order.customer_lng || order.delivery_longitude || 0),
      actorLabel: '配送员'
    });
  }

  return {
    operatorType: isMerchantDeliveryOperator ? 'merchant_delivery' : 'merchant',
    action: isMerchantDeliveryOperator ? '自配送员送达' : '店铺自配送送达',
    remark: isMerchantDeliveryOperator ? '商家自配送员已完成配送' : '店铺自配送已完成',
    notifyMessage: isMerchantDeliveryOperator ? '订单已由商家自配送员送达' : '订单已由店铺送达',
    successMessage: isMerchantDeliveryOperator ? '自配送员已完成订单' : '店铺自配送订单已完成'
  };
};

// ==================== 平台骑手送达区 ====================
const prepareRiderDeliveryCompletion = ({
  order = {},
  user = {},
  latestActor = null
} = {}) => {
  if (!canCompleteDeliveryTransition(order)) {
    throw createDeliveryError('订单状态不正确');
  }

  assertWithinDeliveryConfirmDistance({
    actorLat: latestActor?.rider_latitude,
    actorLng: latestActor?.rider_longitude,
    customerLat: Number(order.customer_lat || order.delivery_latitude || 0),
    customerLng: Number(order.customer_lng || order.delivery_longitude || 0),
    actorLabel: '骑手'
  });

  return {
    logPayload: buildDeliveryLogPayload({
      orderId: order.id,
      operatorId: user.id,
      operatorType: 'rider',
      action: '确认送达',
      fromStatus: Number(order.status),
      toStatus: 6,
      remark: '骑手正常送达完成'
    }),
    notifyMessage: '订单已送达',
    successMessage: '送达成功'
  };
};

module.exports = {
  prepareMerchantSelfDeliveryCompletion,
  prepareRiderDeliveryCompletion
};
