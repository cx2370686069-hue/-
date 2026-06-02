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

// 县城转乡镇这条链路虽然暂时还共用同一张订单表，
// 但展示口径必须单独收住，避免被误当成“普通县城单”或“普通乡镇原生单”。
const isCountyToTownTransferOrder = (order = {}) => {
  const role = String(order.current_responsible_role || '').trim();
  const transferStatus = String(order.transfer_status || '').trim();
  return Boolean(order.is_transfer_order) &&
    String(order.order_type || '').trim() === 'county' &&
    ['town_stationmaster', 'town_rider'].includes(role) &&
    transferStatus !== 'revoked';
};

// 同样是 status=5，不同配送身份看到的文案可能一样，但分流逻辑还是要先走身份判断。
const resolveDeliveryStatusText = ({ order = {}, deliveryIdentity = null } = {}) => {
  const status = Number(order.status);

  if (isCountyToTownTransferOrder(order)) {
    if ([3, 4].includes(status)) {
      return '待乡镇接力';
    }
    if (status === 5) {
      return String(order.current_responsible_role || '').trim() === 'town_rider'
        ? '乡镇骑手配送中'
        : '乡镇履约中';
    }
  }

  // 乡镇外卖这里单独收一层文案口径：
  // 1. 商家接单后(status=2) 骑手端未接单栏显示“备货中”
  // 2. 商家点出餐完成后(status=3) 显示“出餐完成”
  // 3. 只有骑手真正接单后(status=5) 才显示“配送中”
  if (String(order.order_type || '').trim() === 'town') {
    if (status === 2) {
      return '备货中';
    }
    if (status === 3) {
      return '出餐完成';
    }
  }

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
