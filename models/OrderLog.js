const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 订单日志模型（记录订单状态变化）
const OrderLog = sequelize.define('OrderLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '订单 ID'
  },
  operator_id: {
    type: DataTypes.INTEGER,
    comment: '操作人 ID'
  },
  operator_type: {
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'system', 'dispatcher'),
    comment: '操作人类型'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作动作'
  },
  from_status: {
    type: DataTypes.INTEGER,
    comment: '原状态'
  },
  to_status: {
    type: DataTypes.INTEGER,
    comment: '新状态'
  },
  remark: {
    type: DataTypes.STRING(255),
    comment: '备注'
  }
}, {
  tableName: 'order_logs',
  indexes: [
    { fields: ['order_id'] }
  ]
});

module.exports = OrderLog;
