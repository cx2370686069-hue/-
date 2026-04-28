const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TownErrandConversation = sequelize.define('TownErrandConversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '发起咨询的用户ID'
  },
  stationmaster_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '站长用户ID'
  },
  town_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '所属乡镇名称'
  },
  status: {
    type: DataTypes.ENUM('active', 'closed'),
    allowNull: false,
    defaultValue: 'active',
    comment: '会话状态'
  },
  last_message: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '最后一条消息摘要'
  },
  last_message_sender_type: {
    type: DataTypes.ENUM('user', 'stationmaster'),
    allowNull: true,
    comment: '最后消息发送方'
  },
  last_message_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后消息时间'
  }
}, {
  tableName: 'town_errand_conversations',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['stationmaster_id'] },
    { fields: ['town_name'] },
    { fields: ['status'] },
    { unique: true, fields: ['user_id', 'stationmaster_id', 'town_name'] }
  ]
});

module.exports = TownErrandConversation;
