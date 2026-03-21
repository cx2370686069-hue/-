const { Sequelize } = require('sequelize');
require('dotenv').config();

// 创建数据库连接
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    timezone: '+08:00', // 东八区时间
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true, // 自动创建 createdAt 和 updatedAt 字段
      underscored: true, // 使用下划线命名
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  }
);

// 测试连接
sequelize.authenticate()
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
  });

module.exports = sequelize;
