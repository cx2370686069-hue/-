const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“手机数码商品扩展信息”模型。
// 它专门承接二手数码特有字段，避免把品牌、成色、电池健康这些内容硬塞进 products(商品主表)。
const ProductDigitalProfile = sequelize.define('ProductDigitalProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: '关联商品 ID'
  },
  brand: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '品牌'
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '型号'
  },
  storage: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '存储容量'
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '颜色'
  },
  condition_grade: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '成色等级，如95新'
  },
  battery_health: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '电池健康度'
  },
  network_status: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '网络/版本状态，如国行全网通'
  },
  repair_status: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '维修拆修状态'
  },
  warranty_status: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '保修状态'
  },
  selling_points: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '卖点摘要'
  },
  attrs_json: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '附加参数 JSON'
  }
}, {
  tableName: 'product_digital_profiles',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'uk_product_digital_profiles_product_id',
      unique: true,
      fields: ['product_id']
    },
    {
      name: 'idx_product_digital_profiles_brand',
      fields: ['brand']
    },
    {
      name: 'idx_product_digital_profiles_condition_grade',
      fields: ['condition_grade']
    }
  ]
});

module.exports = ProductDigitalProfile;
