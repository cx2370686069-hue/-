const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
