const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SYSTEM_NOTIFICATION_TARGET_ROLES = ['all', 'user', 'merchant', 'rider'];
const SYSTEM_NOTIFICATION_STATUSES = ['draft', 'published', 'offline'];

const SystemNotification = sequelize.define('SystemNotification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '通知标题'
  },
  summary: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '通知摘要'
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: '通知正文'
  },
  target_role: {
    type: DataTypes.ENUM(...SYSTEM_NOTIFICATION_TARGET_ROLES),
    allowNull: false,
    defaultValue: 'all',
    comment: '目标角色'
  },
  status: {
    type: DataTypes.ENUM(...SYSTEM_NOTIFICATION_STATUSES),
    allowNull: false,
    defaultValue: 'draft',
    comment: '状态：draft-草稿，published-已发布，offline-已下线'
  },
  is_pinned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否置顶'
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '发布时间'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '创建管理员ID'
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '更新管理员ID'
  }
}, {
  tableName: 'system_notifications',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['target_role'] },
    { fields: ['is_pinned'] },
    { fields: ['published_at'] }
  ]
});

module.exports = {
  SystemNotification,
  SYSTEM_NOTIFICATION_TARGET_ROLES,
  SYSTEM_NOTIFICATION_STATUSES
};
