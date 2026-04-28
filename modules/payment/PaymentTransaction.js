const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  biz_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'order'
  },
  channel: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  out_trade_no: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  trade_no: {
    type: DataTypes.STRING(128)
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending'
  },
  paid_at: {
    type: DataTypes.DATE
  },
  notify_id: {
    type: DataTypes.STRING(128)
  },
  request_payload: {
    type: DataTypes.TEXT
  },
  response_payload: {
    type: DataTypes.TEXT
  },
  notify_payload: {
    type: DataTypes.TEXT
  },
  error_message: {
    type: DataTypes.STRING(255)
  }
}, {
  tableName: 'payment_transactions',
  indexes: [
    { fields: ['order_id'] },
    { fields: ['group_id'] },
    { fields: ['biz_type'] },
    { fields: ['out_trade_no'], unique: true },
    { fields: ['trade_no'] },
    { fields: ['status'] },
    { fields: ['channel'] }
  ]
});

module.exports = PaymentTransaction;
