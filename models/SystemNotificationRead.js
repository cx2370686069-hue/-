const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemNotificationRead = sequelize.define('SystemNotificationRead', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  notification_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '系统通知ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '已读用户ID'
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '已读时间'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'system_notification_reads',
  createdAt: false,
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['notification_id', 'user_id'] },
    { fields: ['user_id'] },
    { fields: ['notification_id'] },
    { fields: ['read_at'] }
  ]
});

module.exports = SystemNotificationRead;
