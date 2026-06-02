const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“退款 / 售后工单”模型。
// 用户发起退款后，退款金额、原因、审核状态、到账结果都会记录在这里。
const Refund = sequelize.define('Refund', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  refund_no: {
    type: DataTypes.STRING(32),
    unique: true,
    allowNull: false,
    comment: '退款工单编号（唯一）'
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的订单 ID'
  },
  order_no: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: '订单编号（冗余，方便查询）'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '发起退款的用户 ID'
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '被退款的商家 ID'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '申请退款的金额（支持部分退款）'
  },
  reason_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '退款类型（如：商家未接单、商品撒漏、送错地址等）'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '用户填写的退款详情描述'
  },
  apply_source: {
    type: DataTypes.STRING(30),
    defaultValue: 'after_sale',
    comment: '申请来源：after_sale-售后退款，cancel-取消订单'
  },
  responsibility_type: {
    type: DataTypes.STRING(30),
    comment: '责任归属：user-用户，merchant-商家，platform-平台'
  },
  cancel_fee_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '取消扣费金额'
  },
  is_full_refund: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否全额退款'
  },
  images: {
    type: DataTypes.TEXT,
    comment: '退款凭证图片（JSON数组），最多 3 张'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '退款状态：0-待商家审核，1-商家已同意/退款中，2-退款成功，3-商家拒绝，4-用户取消申请'
  },
  reject_reason: {
    type: DataTypes.STRING(255),
    comment: '商家拒绝退款的原因'
  },
  merchant_audit_at: {
    type: DataTypes.DATE,
    comment: '商家审核时间'
  },
  audit_role: {
    type: DataTypes.STRING(30),
    comment: '审核角色：admin-后台，merchant-商家'
  },
  audit_user_id: {
    type: DataTypes.INTEGER,
    comment: '审核人ID'
  },
  audit_note: {
    type: DataTypes.STRING(255),
    comment: '审核备注'
  },
  success_at: {
    type: DataTypes.DATE,
    comment: '退款真正到账（原路返回或退到余额）的时间'
  },
  payment_transaction_id: {
    type: DataTypes.STRING(64),
    comment: '对应的第三方支付平台的退款交易号（微信/支付宝 out_refund_no）'
  }
}, {
  tableName: 'refunds',
  indexes: [
    { fields: ['refund_no'], unique: true },
    { fields: ['order_id'] },
    { fields: ['merchant_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Refund;
