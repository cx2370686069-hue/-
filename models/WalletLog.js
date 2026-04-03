const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 资金流水日志表（支持骑手、商家、用户的钱包明细）
const WalletLog = sequelize.define('WalletLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的账号 ID（User表的id）'
  },
  role: {
    type: DataTypes.ENUM('user', 'merchant', 'rider'),
    allowNull: false,
    comment: '资金归属角色：用户退款、商家收入、骑手佣金'
  },
  type: {
    type: DataTypes.ENUM('income', 'expense', 'withdraw', 'refund'),
    allowNull: false,
    comment: '流水类型：收入(income)、支出(expense)、提现(withdraw)、退款(refund)'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '变动金额（绝对值）'
  },
  balance_after: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '变动后的账户余额（用于对账）'
  },
  order_id: {
    type: DataTypes.INTEGER,
    comment: '关联的订单 ID（提现可能为空）'
  },
  order_no: {
    type: DataTypes.STRING(32),
    comment: '关联的订单号（方便查询）'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '流水标题（如：外卖订单收入、骑手配送费提成、余额提现）'
  },
  remark: {
    type: DataTypes.STRING(255),
    comment: '详细备注或退款原因'
  }
}, {
  tableName: 'wallet_logs',
  indexes: [
    { fields: ['user_id', 'role'] },
    { fields: ['order_id'] },
    { fields: ['type'] }
  ]
});

module.exports = WalletLog;
