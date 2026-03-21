const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 商品分类模型
const ProductCategory = sequelize.define('ProductCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '所属商家 ID'
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '分类名称'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序'
  }
}, {
  tableName: 'product_categories',
  indexes: [
    { fields: ['merchant_id'] }
  ]
});

module.exports = ProductCategory;
