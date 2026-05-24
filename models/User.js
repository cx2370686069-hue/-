const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// 这张表是“用户主表”模型。
// 普通用户、商家账号、骑手、商家自配送员、管理员，都共用这一张 users(用户表)。
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: '手机号'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
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
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'merchant_delivery', 'admin'),
    allowNull: false,
    defaultValue: 'user',
    comment: '角色：user-用户，merchant-商家，rider-骑手，merchant_delivery-商家自配送员工，admin-管理员'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '状态：0-禁用，1-正常'
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: '用户/骑手通用余额',
    get() {
      const value = this.getDataValue('balance');
      return value === null ? 0 : parseFloat(value);
    }
  },
  // 骑手 / 商家自配送员专属字段
  rider_status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '骑手状态：0-休息，1-接单中'
  },
  rider_audit_status: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '骑手审核状态：0-待审核，1-已通过，2-已拒绝'
  },
  rider_audited_by_role: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '骑手最终审核角色：admin-总后台，stationmaster-乡镇站长'
  },
  rider_audited_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '骑手最终审核人ID'
  },
  rider_audited_by_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '骑手最终审核人名称'
  },
  rider_audited_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '骑手审核时间'
  },
  rider_reject_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '骑手驳回原因'
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
  delivery_scope: {
    type: DataTypes.ENUM('county_delivery', 'town_delivery'),
    allowNull: true,
    comment: '配送业务线：county_delivery-县城配送，town_delivery-乡镇配送'
  },
  rider_level: {
    type: DataTypes.ENUM('captain', 'normal'),
    allowNull: true,
    comment: '骑手层级：captain-站长，normal-普通骑手'
  },
  town_code: {
    type: DataTypes.STRING(32),
    comment: '所属乡镇编码'
  },
  town_name: {
    type: DataTypes.STRING(50),
    comment: '所属乡镇名称'
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
  },
  bound_merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '绑定店铺ID（商家自配送员工）'
  }
}, {
  tableName: 'users',
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['phone'] },
    { fields: ['role'] },
    { fields: ['bound_merchant_id'] },
    { fields: ['delivery_scope'] },
    { fields: ['town_code'] }
  ]
});

// 新建账号时自动加密密码。
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// 修改密码时也自动重新加密。
User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// 实例方法：校验明文密码是否和数据库中的加密密码匹配。
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;
