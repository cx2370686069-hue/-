const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 这张表是“商家推送设备”模型。
// 商家端每台设备的 client_id、平台信息、推送开关、最近推送结果，都记录在这里。
const MerchantPushDevice = sequelize.define('MerchantPushDevice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商家ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '商家账号用户ID'
  },
  client_id: {
    type: DataTypes.STRING(128),
    allowNull: false,
    comment: 'UniPush/个推客户端ID'
  },
  app_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '应用AppID'
  },
  platform: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'android',
    comment: '客户端平台'
  },
  os_name: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '系统名称'
  },
  device_brand: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '设备品牌'
  },
  device_model: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '设备型号'
  },
  app_version: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '应用版本'
  },
  app_state: {
    type: DataTypes.ENUM('foreground', 'background', 'unknown'),
    allowNull: false,
    defaultValue: 'unknown',
    comment: 'App当前状态'
  },
  notification_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '系统通知是否开启'
  },
  push_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '是否允许作为推送目标'
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '最后活跃时间'
  },
  last_push_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后一次下发推送时间'
  },
  last_push_result: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '最后一次推送结果'
  },
  last_error: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '最后一次推送错误'
  }
}, {
  tableName: 'merchant_push_devices',
  indexes: [
    { unique: true, fields: ['client_id'] },
    { fields: ['merchant_id', 'push_enabled'] },
    { fields: ['user_id', 'push_enabled'] },
    { fields: ['last_seen_at'] }
  ]
});

module.exports = MerchantPushDevice;
