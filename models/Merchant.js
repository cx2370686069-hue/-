const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 商家店铺模型
const Merchant = sequelize.define('Merchant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联用户 ID'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '店铺名称'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '店铺描述'
  },
  logo: {
    type: DataTypes.STRING(255),
    comment: '店铺 Logo URL'
  },
  cover: {
    type: DataTypes.STRING(255),
    comment: '店铺封面 URL'
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: '联系电话'
  },
  address: {
    type: DataTypes.STRING(255),
    comment: '店铺地址'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    comment: '纬度'
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    comment: '经度'
  },
  delivery_radius: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0,
    comment: '配送半径（公里）'
  },
  min_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '起送价'
  },
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '配送费'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '营业状态：0-休息，1-营业'
  },
  audit_status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '审核状态：0-待审核，1-已通过，2-已拒绝'
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '可提现余额'
  },
  withdrawn_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '累计已提现金额'
  },
  total_income: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '累计收入（已结算）'
  }
}, {
  tableName: 'merchants',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Merchant;
