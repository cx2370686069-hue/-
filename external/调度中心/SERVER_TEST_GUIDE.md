# 服务器端测试快速开始指南

## 📋 概述

本指南帮助您快速在服务器端测试天地图和GraphHopper的路径规划功能，无需浏览器。

## 🚀 快速开始

### 本地测试（部署前）

#### 1. 启动后端服务

```bash
cd d:\外卖拼单实验\04-backend
npm install
npm start
```

#### 2. 启动 GraphHopper（新终端）

```bash
cd d:\外卖拼单实验
.\start-graphhopper.bat
```

等待 GraphHopper 启动完成（首次启动需要5-10分钟）。

#### 3. 运行服务器端测试

```bash
cd d:\外卖拼单实验\04-backend
node test-server-integration.js
```

### 阿里云服务器测试（部署后）

#### 1. 部署到阿里云

详细步骤请参考：[ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md)

#### 2. 运行服务器端测试

```bash
# SSH 连接到服务器
ssh root@your-server-ip

# 进入项目目录
cd /opt/delivery-map-test/04-backend

# 运行完整测试
node test-server-integration.js

# 如果服务不在默认端口，使用环境变量
BACKEND_URL=http://localhost:3000 GRAPHHOPPER_URL=http://localhost:8989 node test-server-integration.js
```

#### 3. 持续监控服务健康状态

```bash
# 单次检查
node health-check.js once

# 持续监控（每分钟检查一次）
node health-check.js monitor

# 自定义检查间隔（每30秒）
CHECK_INTERVAL=30000 node health-check.js monitor
```

## 📊 测试内容说明

### 测试1：后端健康检查
- 检查后端服务是否正常运行
- 验证 WebSocket 连接状态
- 测试地址：`http://localhost:3000/api/health`

### 测试2：GraphHopper健康检查
- 检查 GraphHopper 服务是否正常运行
- 获取 GraphHopper 版本信息
- 测试地址：`http://localhost:8989/health`

### 测试3：天地图路线规划
- 测试天地图驾车路线规划功能
- 通过后端代理调用天地图API
- 获取距离、时间、路线点等信息

### 测试4：GraphHopper路线规划
- 测试 GraphHopper 路线规划功能
- 支持多种交通方式（驾车、骑行、步行）
- 获取导航指引信息

### 测试5：GraphHopper导航
- 测试 GraphHopper 导航功能
- 获取语音导航指引
- 适用于骑手端实时导航

### 测试6：多点路线规划
- 模拟外卖配送的多点路线
- 测试多个配送点的路线规划
- 计算总距离和总时间

### 测试7：TSP优化
- 测试旅行商问题优化
- 自动排序配送点以优化路线
- 减少配送距离和时间

### 测试8：不同交通方式对比
- 对比驾车、骑行、步行的路线
- 验证不同交通方式的规划结果

## 🔧 环境变量配置

### 测试脚本环境变量

```bash
# 后端服务地址
BACKEND_URL=http://localhost:3000

# GraphHopper服务地址
GRAPHHOPPER_URL=http://localhost:8989
```

### 健康检查脚本环境变量

```bash
# 后端服务地址
BACKEND_URL=http://localhost:3000

# GraphHopper服务地址
GRAPHHOPPER_URL=http://localhost:8989

# 日志文件路径
LOG_FILE=/opt/delivery-map-test/04-backend/health-check.log

# 警报文件路径
ALERT_FILE=/opt/delivery-map-test/04-backend/health-alerts.log

# 检查间隔（毫秒）
CHECK_INTERVAL=60000
```

## 📝 测试结果解读

### 成功标志

```
✅ 所有测试通过！系统可以正常使用。
```

### 失败标志

```
⚠️  部分测试失败，请检查相关服务。
```

### 常见错误及解决方案

#### 错误1：无法连接后端服务

**错误信息：**
```
❌ 无法连接后端服务
   错误: connect ECONNREFUSED 127.0.0.1:3000
```

**解决方案：**
```bash
# 检查后端服务是否启动
pm2 status

# 如果未启动，启动服务
pm2 start server.js --name "delivery-backend"

# 查看日志
pm2 logs delivery-backend
```

#### 错误2：无法连接 GraphHopper 服务

**错误信息：**
```
❌ 无法连接GraphHopper服务
   错误: connect ECONNREFUSED 127.0.0.1:8989
```

**解决方案：**
```bash
# 检查 Docker 容器状态
docker-compose ps

# 如果未启动，启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f graphhopper
```

#### 错误3：天地图 API 调用失败

**错误信息：**
```
❌ 天地图路线规划失败
   错误: 天地图API调用失败
```

**解决方案：**
```bash
# 检查后端代理
curl http://localhost:3000/api/tianditu/myip

# 确认IP已添加到天地图白名单
# 检查天地图密钥是否正确
```

## 📈 性能监控

### 查看服务状态

```bash
# 查看后端服务状态
pm2 status

# 查看 GraphHopper 状态
docker-compose ps

# 查看系统资源
htop
```

### 查看日志

```bash
# 查看后端日志
pm2 logs delivery-backend

# 查看 GraphHopper 日志
docker-compose logs -f graphhopper

# 查看健康检查日志
tail -f health-check.log

# 查看警报日志
tail -f health-alerts.log
```

## 🎯 下一步

1. **本地测试通过**：确认所有测试通过后，可以开始部署到阿里云
2. **部署到阿里云**：按照 [ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md) 部署到服务器
3. **服务器测试**：在阿里云服务器上运行测试脚本
4. **持续监控**：使用健康检查脚本持续监控服务状态
5. **集成到主项目**：将测试通过的服务集成到外卖系统中

## 📞 获取帮助

如有问题，请查看：
- 部署文档：[ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md)
- 项目文档：[README.md](./README.md)
- GraphHopper 文档：https://docs.graphhopper.com/
- 天地图文档：http://lbs.tianditu.gov.cn/home.html

## 📌 注意事项

1. **首次启动 GraphHopper**：需要5-10分钟加载地图数据，请耐心等待
2. **天地图白名单**：确保服务器IP已添加到天地图白名单
3. **端口占用**：确保3000和8989端口未被占用
4. **防火墙设置**：确保防火墙已开放必要端口
5. **资源限制**：GraphHopper需要较多内存，建议服务器至少2GB内存
