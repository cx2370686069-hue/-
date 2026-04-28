const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 购物车项模型
// 复用历史 cart_items 表，沿用 food_* 老字段名，代码层兼容当前 product 语义。
const CartItem = sequelize.define('CartItem', {
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
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '商家 ID'
  },
  food_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商品 ID（历史字段名）'
  },
  food_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品名称（历史字段名）'
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: '商品单价'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: '数量'
  },
  selected_spec: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '已选规格文本'
  }
}, {
  tableName: 'cart_items',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['merchant_id'] },
    { fields: ['food_id'] }
  ]
});

module.exports = CartItem;
