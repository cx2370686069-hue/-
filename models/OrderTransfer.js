const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“订单转派记录”模型。
// 每次县城骑手转站长、站长转乡镇骑手、以及撤回动作，都会留下独立记录。
const OrderTransfer = sequelize.define('OrderTransfer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '订单ID'
  },
  transfer_round: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: '第几次转派'
  },
  from_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '转派发起人'
  },
  from_role: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'rider',
    comment: '发起人角色摘要'
  },
  from_scope: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '发起人配送范围'
  },
  from_town_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '发起人所属乡镇'
  },
  to_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '转派目标人'
  },
  to_role: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'rider',
    comment: '目标人角色摘要'
  },
  to_scope: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '目标人配送范围'
  },
  to_town_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '目标乡镇'
  },
  status_before_transfer: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '转派时订单状态'
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '转派备注'
  },
  is_revoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否已撤回'
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '撤回时间'
  },
  revoked_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '撤回人'
  },
  revoke_remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '撤回备注'
  }
}, {
  tableName: 'order_transfers',
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['to_user_id'] },
    { fields: ['from_user_id'] },
    { fields: ['is_revoked'] },
    { fields: ['transfer_round'] }
  ]
});

module.exports = OrderTransfer;
