const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const USER_FEEDBACK_STATUSES = ['pending', 'processing', 'resolved'];

const UserFeedback = sequelize.define('UserFeedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '提交用户ID'
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: '投诉建议正文'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '联系电话'
  },
  status: {
    type: DataTypes.ENUM(...USER_FEEDBACK_STATUSES),
    allowNull: false,
    defaultValue: 'pending',
    comment: '处理状态：pending-待处理，processing-处理中，resolved-已处理'
  },
  handled_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '处理管理员ID'
  },
  handled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '处理时间'
  }
}, {
  tableName: 'user_feedbacks',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = {
  UserFeedback,
  USER_FEEDBACK_STATUSES
};
