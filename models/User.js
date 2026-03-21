const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// 用户模型（包含普通用户、商家、骑手）
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    unique: true,
    comment: '手机号'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码（加密存储）'
  },
  nickname: {
    type: DataTypes.STRING(50),
    comment: '昵称'
  },
  avatar: {
    type: DataTypes.STRING(255),
    comment: '头像 URL'
  },
  role: {
    type: DataTypes.ENUM('user', 'merchant', 'rider'),
    allowNull: false,
    defaultValue: 'user',
    comment: '角色：user-用户，merchant-商家，rider-骑手'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '状态：0-禁用，1-正常'
  },
  // 骑手专属字段
  rider_status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '骑手状态：0-休息，1-接单中'
  },
  rider_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '骑手余额'
  },
  rider_kind: {
    type: DataTypes.ENUM('rider', 'stationmaster'),
    defaultValue: 'rider',
    comment: '骑手类型：rider-普通骑手，stationmaster-乡镇站长'
  },
  rider_town: {
    type: DataTypes.STRING(50),
    comment: '所属乡镇（站长必填，用于乡镇外卖自动分配）'
  },
  rider_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    comment: '骑手当前位置纬度'
  },
  rider_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    comment: '骑手当前位置经度'
  },
  rider_location_updated_at: {
    type: DataTypes.DATE,
    comment: '骑手位置更新时间'
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['phone'] },
    { fields: ['role'] }
  ]
});

// 密码加密钩子
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// 验证密码方法
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
