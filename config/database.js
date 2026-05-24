const { Sequelize } = require('sequelize');
require('dotenv').config();

// 这个文件就是“数据库连接总入口”。
// 后端一启动，Sequelize 就会从这里读环境变量去连 MySQL。
// 如果以后遇到“连不上数据库”“连接超时”“连接池爆满”之类的问题，先看这里。
function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// 这些池参数都支持用环境变量覆盖；没配时走下面这组兜底值。
// 这样本地开发和云端部署可以共用同一份代码，只改服务器环境变量就行。
const DB_POOL_MAX = toPositiveInt(process.env.DB_POOL_MAX, 20);
const DB_POOL_MIN = toPositiveInt(process.env.DB_POOL_MIN, 2);
const DB_POOL_ACQUIRE = toPositiveInt(process.env.DB_POOL_ACQUIRE, 15000);
const DB_POOL_IDLE = toPositiveInt(process.env.DB_POOL_IDLE, 10000);
const DB_CONNECT_TIMEOUT = toPositiveInt(process.env.DB_CONNECT_TIMEOUT, 10000);

// 真正的 Sequelize 实例在这里创建。
// 下面这些 DB_NAME / DB_USER / DB_PASSWORD / DB_HOST / DB_PORT 都来自 .env(环境变量文件)。
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    timezone: '+08:00', // 东八区时间
    dialectOptions: {
      connectTimeout: DB_CONNECT_TIMEOUT
    },
    pool: {
      max: DB_POOL_MAX,
      min: DB_POOL_MIN,
      acquire: DB_POOL_ACQUIRE,
      idle: DB_POOL_IDLE
    },
    define: {
      timestamps: true, // 自动创建 createdAt 和 updatedAt 字段
      underscored: true, // 使用下划线命名
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  }
);

// 文件一加载就先做一次连接校验，方便服务启动时立刻暴露数据库问题。
sequelize.authenticate()
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
  });

module.exports = sequelize;
