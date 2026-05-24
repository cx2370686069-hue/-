// 这个文件是“配送日志字段整理器”。
// 不同配送动作最后都要落到 order_logs(订单日志表)，这里负责把字段整理成统一格式。
const normalizeDeliveryLogOperatorType = (rawType = '') => {
  if (rawType === 'merchant_delivery' || rawType === 'delivery') {
    return 'rider';
  }
  return rawType || 'system';
};

// 有些角色在旧日志体系里没有单独枚举，这里先做一次兼容归一化。
const buildDeliveryLogPayload = ({
  orderId,
  operatorId = null,
  operatorType = 'system',
  action,
  fromStatus = null,
  toStatus = null,
  remark = ''
}) => ({
  order_id: orderId,
  operator_id: operatorId,
  operator_type: normalizeDeliveryLogOperatorType(operatorType),
  action,
  from_status: fromStatus,
  to_status: toStatus,
  remark
});

module.exports = {
  buildDeliveryLogPayload,
  normalizeDeliveryLogOperatorType
};
