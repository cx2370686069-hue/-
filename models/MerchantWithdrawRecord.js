const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“商家提现申请记录”模型。
// 商家发起提现后，提现金额、申请前后余额、处理状态，都会落在这里。
const MerchantWithdrawRecord = sequelize.define('MerchantWithdrawRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  withdraw_no: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    comment: '提现申请单号'
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商家ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商家账号ID'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '提现金额'
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '提现状态：pending-待处理，paid-已打款，rejected-已驳回'
  },
  bank_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '开户行名称'
  },
  bank_card: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '银行卡号'
  },
  balance_before: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '申请前余额'
  },
  balance_after: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '申请后余额'
  },
  applied_at: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '申请时间'
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '处理时间'
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'merchant_withdraw_records',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['merchant_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['applied_at'] },
    { fields: ['withdraw_no'], unique: true }
  ]
});

module.exports = MerchantWithdrawRecord;
