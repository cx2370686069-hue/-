const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 商品模型
const Product = sequelize.define('Product', {
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
  category_id: {
    type: DataTypes.INTEGER,
    comment: '分类 ID'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品名称'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '商品描述'
  },
  images: {
    type: DataTypes.TEXT,
    comment: '商品图片（JSON 数组）'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '商品价格'
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    comment: '原价'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 999,
    comment: '库存'
  },
  sales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '销量'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '状态：0-下架，1-上架'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序'
  }
}, {
  tableName: 'products',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['merchant_id'] },
    { fields: ['category_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Product;
