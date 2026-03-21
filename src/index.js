const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

const { sequelize } = require('../models');
const routes = require('../routes');
const errorHandler = require('../middleware/errorHandler');
const socketService = require('../services/socketService');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '跑腿后端 API',
    version: '1.0.0',
    description: '县城乡镇外卖跑腿 APP 后端服务',
    endpoints: {
      auth: '/api/auth',
      merchant: '/api/merchant',
      order: '/api/order',
      address: '/api/address',
      health: '/api/health'
    },
    socket: 'ws://localhost:' + PORT
  });
});

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ 数据库表同步完成');

    socketService.init(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   🚀 跑腿后端服务已启动                        ║
║                                               ║
║   访问地址：http://localhost:${PORT}            ║
║   API 地址：http://localhost:${PORT}/api         ║
║   WebSocket：ws://localhost:${PORT}             ║
║                                               ║
║   按 Ctrl+C 停止服务                           ║
║                                               ║
╚═══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
