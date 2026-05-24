const {
  DEFAULT_STATUS_TEXT_MAP
} = require('./constants');
const { isSelfDeliveryIdentity } = require('../identities');

// 这个文件是“配送状态机辅助工具”。
// 它不负责真正改状态，只负责回答：
// - 当前状态能不能开始配送
// - 当前状态能不能确认送达
// - 前端应该显示什么状态文案
const canStartSelfDeliveryTransition = (order = {}) => Number(order.status) === 3;

const canCompleteDeliveryTransition = (order = {}) => Number(order.status) === 5;

// 同样是 status=5，不同配送身份看到的文案可能一样，但分流逻辑还是要先走身份判断。
const resolveDeliveryStatusText = ({ order = {}, deliveryIdentity = null } = {}) => {
  const status = Number(order.status);

  if (isSelfDeliveryIdentity(deliveryIdentity)) {
    if (status === 3) {
      return '待配送';
    }
    if (status === 5) {
      return '配送中';
    }
  }

  return DEFAULT_STATUS_TEXT_MAP[status] || '未知状态';
};

module.exports = {
  canStartSelfDeliveryTransition,
  canCompleteDeliveryTransition,
  resolveDeliveryStatusText
};
