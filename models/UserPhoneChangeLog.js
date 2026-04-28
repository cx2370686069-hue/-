const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserPhoneChangeLog = sequelize.define('UserPhoneChangeLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  old_phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: '变更前手机号'
  },
  new_phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: '变更后手机号'
  },
  change_year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '自然年，用于年度次数限制'
  },
  verify_method: {
    type: DataTypes.ENUM('password'),
    allowNull: false,
    defaultValue: 'password',
    comment: '本次换绑校验方式'
  }
}, {
  tableName: 'user_phone_change_logs',
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['change_year'] },
    { fields: ['user_id', 'change_year'] }
  ]
});

module.exports = UserPhoneChangeLog;
