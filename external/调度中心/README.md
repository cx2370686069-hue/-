# 固始县外卖拼单调度系统

一个基于 Node.js + WebSocket 的乡镇外卖配送调度平台，支持实时订单监控、智能路径规划和批次集单配送。

## 业务模式

```
县城商家 → 6 个货车司机 → 15 个乡镇站点 → 站长配送到户
```

### 核心特点

- **集单配送**：每小时一个批次，集中配送
- **路径优化**：K-Means聚类 + 最近邻算法，自动规划 6 条最优线路
- **实时调度**：WebSocket 实时推送订单和位置信息
- **人工确认**：算法推荐线路，管理员确认后执行

## 技术栈

### 后端
- **框架**: Node.js + Express
- **数据库**: SQLite
- **实时通信**: Socket.io
- **算法**: K-Means 聚类 + 最近邻路径优化

### 前端
- **地图**: 天地图 API
- **框架**: 原生 JavaScript
- **样式**: 自定义 CSS

## 功能模块

### 1. 调度台（后台管理）
- 实时订单地图显示
- 批次集单管理（倒计时、进度条）
- 6 个司机状态监控
- 智能线路生成
- 人工确认派单

### 2. 司机端
- 任务列表查看
- 位置实时更新
- 配送状态管理（取货→配送→送达）
- 地图导航

### 3. 算法核心
- **聚类算法**: `02-algorithm-design/clustering.js`
  - K-Means 聚类（K=6）
  - 按乡镇分组
  - 智能聚类（结合乡镇和地理位置）

- **路径优化**: `02-algorithm-design/routing.js`
  - 最近邻算法
  - 路径距离计算
  - 负载均衡
  - 时间约束过滤

## 快速开始

### 1. 安装依赖

```bash
cd 04-backend
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器启动后访问：http://localhost:3000

### 3. 初始化司机

在调度台点击"初始化 6 司机"按钮，创建 6 个司机账号（D1-D6）

### 4. 测试流程

1. 添加订单（系统会自动生成示例订单）
2. 等待集单（批次倒计时）
3. 点击"生成配送线路"
4. 查看推荐线路和报告
5. 确认派单
6. 司机端查看任务

## API 接口

### 订单
- `GET /api/orders` - 获取所有订单
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id/status` - 更新订单状态
- `GET /api/orders/pending/list` - 获取待配送订单

### 司机
- `GET /api/drivers` - 获取所有司机
- `POST /api/drivers` - 创建司机
- `PUT /api/drivers/:id/status` - 更新司机状态
- `PUT /api/drivers/:id/location` - 更新司机位置
- `GET /api/drivers/:id/tasks` - 获取司机任务

### 批次
- `GET /api/batches/current` - 获取当前批次
- `POST /api/batches` - 创建批次
- `PUT /api/batches/:id/status` - 更新批次状态
- `GET /api/batches/:id/orders` - 获取批次订单

### 线路
- `POST /api/routes/generate` - 生成配送线路
- `GET /api/routes` - 获取所有线路
- `POST /api/routes/:id/assign` - 分配线路给司机

## WebSocket 事件

### 客户端 → 服务器
- `join_dispatch` - 加入调度室
- `join_driver` - 司机加入房间
- `driver_location` - 上报司机位置
- `order_status_update` - 更新订单状态

### 服务器 → 客户端
- `new_order` - 新订单通知
- `order_updated` - 订单更新
- `driver_location_update` - 司机位置更新
- `driver_added/updated/removed` - 司机变化

## 数据表结构

### orders（订单表）
```sql
- id: 订单 ID
- restaurant: 商家名称
- restaurant_lat/lon: 商家位置
- customer_town: 客户乡镇
- customer_lat/lon: 客户位置
- status: 状态（pending/assigned/delivering/completed）
- order_type: 类型（county/town）
- batch_id: 批次 ID
- driver_id: 司机 ID
```

### drivers（司机表）
```sql
- id: 司机 ID
- name: 姓名
- phone: 电话
- status: 状态（free/busy/offline）
- current_lat/lon: 当前位置
- vehicle_type: 车型
- max_capacity: 最大载单量
```

### batches（批次表）
```sql
- id: 批次 ID
- start_time: 开始时间
- end_time: 结束时间
- status: 状态（collecting/dispatching/completed）
- total_orders: 订单数量
```

### routes（线路表）
```sql
- id: 线路 ID
- batch_id: 批次 ID
- driver_id: 司机 ID
- orders: 订单列表（JSON）
- path: 路径（JSON）
- estimated_distance: 预估距离
- estimated_time: 预估时间
- status: 状态
```

## 算法说明

### K-Means 聚类流程

1. 提取所有订单的经纬度坐标
2. 随机选择 6 个点作为初始质心
3. 为每个订单分配最近的质心
4. 重新计算每个聚类的质心
5. 重复步骤 3-4 直到收敛
6. 输出 6 个聚类（每个聚类对应一个司机）

### 路径优化流程

1. 从配送中心出发
2. 使用最近邻算法：
   - 找到当前点最近的未访问点
   - 移动到该点
   - 重复直到所有点访问完毕
3. 计算总距离和预估时间
4. 检查时间约束（≤60 分钟）
5. 负载均衡调整

## 配置说明

### 天地图 API Key
在 `03-frontend/index.html` 和 `api.js` 中配置：
```javascript
const TIANDITU_KEY = '2c13930c89641751455d91654dc9640d';
```

### 配送中心坐标
在 `03-frontend/app.js` 中配置：
```javascript
const CONFIG = {
    CENTER: { lat: 32.168, lon: 115.654, name: '固始县政府' },
    TOWNS: [...] // 15 个乡镇坐标
};
```

### 算法参数
在 `04-backend/routes/routes.js` 中配置：
```javascript
const DISTRIBUTION_CENTER = { lat: 32.168, lon: 115.654 };
const k = 6; // 聚类数量（司机数量）
const maxTime = 60; // 最大配送时间（分钟）
```

## 开发计划

### 已完成
- ✅ WebSocket 实时通信
- ✅ 订单地图显示
- ✅ 司机管理模块
- ✅ 批次集单管理
- ✅ K-Means 聚类算法
- ✅ 路径优化算法
- ✅ 线路生成接口
- ✅ 司机端页面

### 待开发
- [ ] 机器学习预测订单量
- [ ] 历史数据分析
- [ ] 司机 APP（替代网页版）
- [ ] 站长端小程序
- [ ] 固定线路优化
- [ ] 订单热力图

## 常见问题

### Q: 如何修改乡镇列表？
A: 编辑 `03-frontend/app.js` 中的 `CONFIG.TOWNS` 数组

### Q: 如何调整集单时间？
A: 修改 `04-backend/routes/batches.js` 中的批次创建逻辑

### Q: 如何更改司机数量？
A: 修改 `04-backend/routes/routes.js` 中的 `k` 参数（默认 6）

### Q: WebSocket 连接失败？
A: 检查防火墙设置，确保 3000 端口开放

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发者。
