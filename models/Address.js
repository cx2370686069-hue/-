const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 用户地址模型
const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户 ID'
  },
  contact_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '联系人'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '联系电话'
  },
  province: {
    type: DataTypes.STRING(50),
    comment: '省'
  },
  city: {
    type: DataTypes.STRING(50),
    comment: '市'
  },
  district: {
    type: DataTypes.STRING(50),
    comment: '区/县'
  },
  street: {
    type: DataTypes.STRING(100),
    comment: '街道/乡镇'
  },
  detail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '详细地址'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    comment: '纬度'
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    comment: '经度'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否默认地址'
  }
}, {
  tableName: 'addresses',
  indexes: [
    { fields: ['user_id'] }
  ]
});

module.exports = Address;
