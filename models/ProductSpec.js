const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 商品规格及属性表（支持“大中小杯”、“微辣/中辣/不加葱”等扩展）
const ProductSpec = sequelize.define('ProductSpec', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的商品 ID'
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '规格名称，例如：大杯、微辣、加珍珠'
  },
  group_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '规格组，例如：杯型、口味、加料'
  },
  price_extra: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '选中该规格时的额外加价（如加珍珠 +2.00，也可为0或负数）'
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '该组规格是否为必选项（如杯型是必选，加料是可选）'
  },
  is_multiple: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '该组规格是否允许多选（如口味单选，加料多选）'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '状态：0-停用，1-启用'
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '展示排序（升序）'
  }
}, {
  tableName: 'product_specs',
  indexes: [
    { fields: ['product_id'] },
    { fields: ['group_name'] }
  ]
});

module.exports = ProductSpec;
