const {
  DELIVERY_RESPONSIBLE_ROLES,
  createDeliveryError
} = require('../shared/constants');
const {
  canStartSelfDeliveryTransition
} = require('../shared/state-machine');
const {
  buildDeliveryLogPayload
} = require('../shared/log-policy');

// 这个文件专门管“开始配送前的准备逻辑”。
// 目前这里主要覆盖商家自配送链路：从待配送切到配送中时，该改哪些字段、该记什么日志。
const prepareMerchantSelfDeliveryStart = ({
  order = {},
  user = {},
  isMerchantDeliveryOperator = false
} = {}) => {
  if (!canStartSelfDeliveryTransition(order)) {
    throw createDeliveryError('店铺自配送订单需要先备货完成后再开始配送');
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

  const fromStatus = Number(order.status);
  return {
    updatePatch: {
      status: 5,
      rider_id: isMerchantDeliveryOperator ? user.id : null,
      current_responsible_user_id: isMerchantDeliveryOperator ? user.id : null,
      current_responsible_role: isMerchantDeliveryOperator
        ? DELIVERY_RESPONSIBLE_ROLES.MERCHANT_DELIVERY
        : null,
      dispatch_center_status: 'self_delivery'
    },
    logPayload: buildDeliveryLogPayload({
      orderId: order.id,
      operatorId: user.id,
      operatorType: isMerchantDeliveryOperator
        ? DELIVERY_RESPONSIBLE_ROLES.MERCHANT_DELIVERY
        : 'merchant',
      action: isMerchantDeliveryOperator ? '自配送员开始配送' : '老板开始配送',
      fromStatus,
      toStatus: 5,
      remark: isMerchantDeliveryOperator
        ? '该订单已由商家自配送员接手配送'
        : '该订单进入店铺自配送中'
    }),
    notifyMessage: isMerchantDeliveryOperator ? '商家自配送员正在为您配送' : '店铺正在为您配送',
    successMessage: isMerchantDeliveryOperator ? '已进入自配送员配送中' : '已进入店铺自配送'
  };
};

module.exports = {
  prepareMerchantSelfDeliveryStart
};
