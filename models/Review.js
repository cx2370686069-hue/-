const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 用户对订单（商家+骑手）的评价表
const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false,
    comment: '关联订单 ID，一单只能评一次'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '评价的用户 ID'
  },
  merchant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '被评价的商家 ID'
  },
  rider_id: {
    type: DataTypes.INTEGER,
    comment: '被评价的骑手 ID（如果是自提或到店则为空）'
  },
  merchant_score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: '对商家的评分：1~5 颗星'
  },
  merchant_content: {
    type: DataTypes.TEXT,
    comment: '对商家的文字评价内容（好吃、难吃、口味太淡等）'
  },
  merchant_images: {
    type: DataTypes.TEXT,
    comment: '买家秀图片（JSON数组），最多 3 张'
  },
  merchant_reply: {
    type: DataTypes.TEXT,
    comment: '商家的官方回复内容（感谢支持/不好意思）'
  },
  merchant_replied_at: {
    type: DataTypes.DATE,
    comment: '商家回复的时间'
  },
  rider_score: {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 },
    comment: '对骑手的评分：1~5 颗星'
  },
  rider_content: {
    type: DataTypes.TEXT,
    comment: '对骑手的文字评价（送得快、态度差等）'
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否匿名评价（保护用户隐私，前端展示星号）'
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '评价状态：0-已隐藏/违规折叠，1-正常展示，2-置顶推荐（精选）'
  }
}, {
  tableName: 'reviews',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['order_id'], unique: true },
    { fields: ['merchant_id'] },
    { fields: ['rider_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Review;
