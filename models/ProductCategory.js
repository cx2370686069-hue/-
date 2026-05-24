const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“商品分类”模型。
// 每个商家自己的商品分组，例如饮品、小吃、主食，都会落在这里。
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
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['merchant_id'] }
  ]
});

module.exports = ProductCategory;
