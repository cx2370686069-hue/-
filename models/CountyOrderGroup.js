const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CountyOrderGroup = sequelize.define('CountyOrderGroup', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  group_no: {
    type: DataTypes.STRING(32),
    unique: true,
    allowNull: false,
    comment: '县城美食拼单组编号'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '下单用户ID'
  },
  main_order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '主店子订单ID'
  },
  main_merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '主店商家ID'
  },
  store_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '本次拼单店铺数量'
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '状态：0待支付，1待接单，7已取消'
  },
  goods_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
    comment: '商品总金额'
  },
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
    comment: '合并配送费'
  },
  package_fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
    comment: '打包费总额'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
    comment: '优惠总额'
  },
  pay_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.0,
    comment: '应付总额'
  },
  customer_town: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '用户所在乡镇'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '联系电话'
  },
  contact_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '联系人'
  },
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '配送地址JSON'
  },
  address: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: '',
    comment: '地址摘要'
  },
  delivery_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    comment: '配送纬度'
  },
  delivery_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    comment: '配送经度'
  },
  customer_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    comment: '客户经度'
  },
  customer_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    comment: '客户纬度'
  },
  payment_channel: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '支付渠道'
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '支付时间'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '用户备注'
  }
}, {
  tableName: 'county_order_groups',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['group_no'], unique: true },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['main_merchant_id'] }
  ]
});

module.exports = CountyOrderGroup;
