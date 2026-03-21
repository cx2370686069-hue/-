const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 订单模型
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_no: {
    type: DataTypes.STRING(32),
    unique: true,
    allowNull: false,
    comment: '订单号'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '下单用户 ID'
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商家 ID'
  },
  rider_id: {
    type: DataTypes.INTEGER,
    comment: '骑手 ID'
  },
  type: {
    type: DataTypes.ENUM('takeout', 'errand'),
    allowNull: false,
    defaultValue: 'takeout',
    comment: '订单类型：takeout-外卖，errand-跑腿'
  },
  order_type: {
    type: DataTypes.ENUM('county', 'town'),
    defaultValue: 'county',
    comment: '外卖业务类型：county-县城外卖（调度中心派单），town-乡镇外卖（站长直送）'
  },
  customer_town: {
    type: DataTypes.STRING(50),
    comment: '客户所在乡镇（用于站长分配/调度中心聚类）'
  },
  dispatch_center_status: {
    type: DataTypes.STRING(20),
    comment: '调度中心状态：pending/sent/failed'
  },
  dispatch_center_order_id: {
    type: DataTypes.STRING(64),
    comment: '调度中心订单ID（默认使用本系统订单ID）'
  },
  dispatch_sent_at: {
    type: DataTypes.DATE,
    comment: '推送调度中心时间'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '订单状态：0-待支付，1-待接单，2-已接单，3-备货中，4-备货完成，5-配送中，6-已完成，7-已取消'
  },
  products_info: {
    type: DataTypes.TEXT,
    comment: '商品信息（JSON）'
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '订单总金额'
  },
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '配送费'
  },
  package_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '打包费'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '优惠金额'
  },
  pay_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '实付金额'
  },
  rider_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '骑手费用'
  },
  // 配送信息
  delivery_type: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '配送方式：1-配送，2-自取'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    comment: '联系电话'
  },
  contact_name: {
    type: DataTypes.STRING(50),
    comment: '联系人'
  },
  delivery_address: {
    type: DataTypes.TEXT,
    comment: '配送地址（JSON：省市区街道门牌号）'
  },
  delivery_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    comment: '配送地址纬度'
  },
  delivery_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    comment: '配送地址经度'
  },
  // 跑腿订单专属字段
  errand_type: {
    type: DataTypes.STRING(50),
    comment: '跑腿类型：买菜/送药/取快递/其他'
  },
  errand_description: {
    type: DataTypes.TEXT,
    comment: '跑腿需求描述'
  },
  // 时间戳
  paid_at: {
    type: DataTypes.DATE,
    comment: '支付时间'
  },
  payment_channel: {
    type: DataTypes.STRING(20),
    comment: '支付渠道：mock/wechat/alipay/balance'
  },
  commission_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '平台抽成金额（基于商品金额）'
  },
  rider_incentive_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '抽成中分给骑手的激励金额'
  },
  platform_income_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '平台收入（抽成扣除骑手激励）'
  },
  merchant_income_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.0,
    comment: '商家收入（已结算口径）'
  },
  settled_at: {
    type: DataTypes.DATE,
    comment: '结算入账时间'
  },
  accepted_at: {
    type: DataTypes.DATE,
    comment: '接单时间'
  },
  delivered_at: {
    type: DataTypes.DATE,
    comment: '送达时间'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '用户备注'
  },
  cancel_reason: {
    type: DataTypes.STRING(255),
    comment: '取消原因'
  }
}, {
  tableName: 'orders',
  indexes: [
    { fields: ['order_no'] },
    { fields: ['user_id'] },
    { fields: ['merchant_id'] },
    { fields: ['rider_id'] },
    { fields: ['status'] },
    { fields: ['type'] }
  ]
});

module.exports = Order;
