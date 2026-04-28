const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TownErrandMessage = sequelize.define('TownErrandMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '所属会话ID'
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '发送人用户ID'
  },
  sender_type: {
    type: DataTypes.ENUM('user', 'stationmaster'),
    allowNull: false,
    comment: '发送方类型'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '文字消息内容'
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否已读'
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '已读时间'
  }
}, {
  tableName: 'town_errand_messages',
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['conversation_id'] },
    { fields: ['sender_id'] },
    { fields: ['sender_type'] },
    { fields: ['is_read'] }
  ]
});

module.exports = TownErrandMessage;
