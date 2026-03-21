/**
 * 固始县外卖调度系统 - 后端服务
 * Express + SQLite + Socket.io
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// 导入路由
const ordersRouter = require('./routes/orders');
const ridersRouter = require('./routes/riders');
const driversRouter = require('./routes/drivers');
const tiandituRouter = require('./routes/tianditu');
const graphhopperRouter = require('./routes/graphhopper');

// 创建 Express 应用
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors()); // 允许跨域
app.use(bodyParser.json()); // 解析 JSON 请求体
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 将 io 实例附加到请求对象，方便路由使用
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 静态文件（前端页面）
app.use(express.static(path.join(__dirname, '../03-frontend')));

// API 路由
app.use('/api/orders', ordersRouter);
app.use('/api/riders', ridersRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/tianditu', tiandituRouter);
app.use('/api/graphhopper', graphhopperRouter);

// 根路由 - 返回前端页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../03-frontend/index.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务正常运行',
        timestamp: new Date().toISOString(),
        websocket: '已启用'
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});

// WebSocket 连接处理
io.on('connection', (socket) => {
    console.log(`🔌 客户端连接: ${socket.id}`);
    
    // 客户端加入调度室
    socket.on('join_dispatch', () => {
        socket.join('dispatch_room');
        console.log(`👥 ${socket.id} 加入调度室`);
    });
    
    // 客户端加入司机房间
    socket.on('join_driver', (driverId) => {
        socket.join(`driver_${driverId}`);
        console.log(`🚗 司机 ${driverId} 上线`);
    });
    
    // 司机位置更新
    socket.on('driver_location', (data) => {
        const { driverId, lat, lon } = data;
        // 广播给调度室
        io.to('dispatch_room').emit('driver_location_update', {
            driverId,
            lat,
            lon,
            timestamp: new Date().toISOString()
        });
    });
    
    // 订单状态更新
    socket.on('order_status_update', (data) => {
        const { orderId, status, driverId } = data;
        // 广播给所有客户端
        io.emit('order_updated', {
            orderId,
            status,
            driverId,
            timestamp: new Date().toISOString()
        });
    });
    
    // 断开连接
    socket.on('disconnect', () => {
        console.log(`❌ 客户端断开: ${socket.id}`);
    });
});

// 启动服务器
httpServer.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║                                                ║');
    console.log('║     固始县外卖调度系统 - 后端服务              ║');
    console.log('║                                                ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 服务器启动成功！`);
    console.log(`📡 HTTP端口: ${PORT}`);
    console.log(`🔌 WebSocket: 已启用`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 API 接口:');
    console.log(`   GET  http://localhost:${PORT}/api/health       健康检查`);
    console.log(`   GET  http://localhost:${PORT}/api/orders       获取所有订单`);
    console.log(`   POST http://localhost:${PORT}/api/orders       创建订单`);
    console.log(`   GET  http://localhost:${PORT}/api/riders       获取所有骑手`);
    console.log(`   POST http://localhost:${PORT}/api/riders       创建骑手`);
    console.log(`   POST http://localhost:${PORT}/api/tianditu/drive  天地图路线规划`);
    console.log(`   POST http://localhost:${PORT}/api/graphhopper/route  GraphHopper路线规划`);
    console.log(`   POST http://localhost:${PORT}/api/graphhopper/navigate  GraphHopper导航`);
    console.log('');
});

// 导出 io 实例供其他模块使用
module.exports = { app, io };
