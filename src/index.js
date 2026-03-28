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
// 支持从环境变量读取 PORT，为生产环境预留灵活性
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// 为阿里云公网部署准备：支持多个来源或完全开放，支持前端通过任何域名/IP访问
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'token']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 统一响应拦截器中间件 (必须放在路由之前)
app.use((req, res, next) => {
  // 保存原始的 res.json 和 res.send
  const originalJson = res.json;
  
  res.json = function(data) {
    // 避免重复包装
    if (data && typeof data === 'object' && ('code' in data) && ('message' in data || 'msg' in data)) {
      // 统一 msg 到 message，保证前端拿到的都是 message
      if (data.msg && !data.message) {
        data.message = data.msg;
        delete data.msg;
      }
      return originalJson.call(this, data);
    }
    
    // 如果返回的不是标准格式，强制包装为标准格式
    return originalJson.call(this, {
      code: 0,
      message: 'success',
      data: data
    });
  };
  next();
});

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
    await sequelize.authenticate();
    console.log('✅ 数据库连接验证完成');

    socketService.init(server);

    server.listen(PORT, () => {
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
