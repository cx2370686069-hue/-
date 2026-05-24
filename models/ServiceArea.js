const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“服务区域”模型。
// 县城 / 乡镇基础数据、区域中心点、别名、启用状态，都会维护在这里。
const ServiceArea = sequelize.define('ServiceArea', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  area_code: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  area_name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  area_type: {
    type: DataTypes.ENUM('county', 'town'),
    allowNull: false
  },
  parent_code: {
    type: DataTypes.STRING(32)
  },
  center_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  center_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  aliases: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'service_areas',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['area_code'] },
    { fields: ['area_type'] },
    { fields: ['parent_code'] },
    { fields: ['is_enabled'] }
  ]
});

module.exports = ServiceArea;
