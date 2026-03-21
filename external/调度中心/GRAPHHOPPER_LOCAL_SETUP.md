# GraphHopper 本地部署指南

## 📋 概述

由于 GraphHopper 官网无法访问，我们采用 **本地部署方案**，无需 API Key，完全免费使用！

## 🎯 方案优势

✅ **无需 API Key** - 本地部署，无需注册账号  
✅ **完全免费** - 无使用次数限制  
✅ **离线可用** - 地图数据存储在本地  
✅ **隐私安全** - 数据不经过第三方服务器  
✅ **高性能** - 本地计算，响应速度快  

## 📦 已创建的文件

1. **[docker-compose.yml](file:///d:/外卖拼单实验/docker-compose.yml)** - Docker 容器配置
2. **[graphhopper-config.yml](file:///d:/外卖拼单实验/graphhopper-config.yml)** - GraphHopper 服务配置
3. **[start-graphhopper.bat](file:///d:/外卖拼单实验/start-graphhopper.bat)** - 一键启动脚本
4. **[04-backend/routes/graphhopper.js](file:///d:/外卖拼单实验/04-backend/routes/graphhopper.js)** - 已更新支持本地 GraphHopper

## 🚀 快速开始

### 方法 1：使用一键启动脚本（推荐）

1. **确保 Docker 已安装**
   - 下载 Docker Desktop: https://www.docker.com/products/docker-desktop
   - 安装并启动 Docker Desktop

2. **运行启动脚本**
   ```bash
   双击运行: start-graphhopper.bat
   ```

3. **等待服务初始化**
   - 首次启动需要下载地图数据（约 1.5GB）
   - 地图数据加载需要 5-10 分钟
   - 等待看到 "GraphHopper 服务启动成功！" 提示

### 方法 2：手动启动

1. **下载地图数据**
   ```bash
   # 创建数据目录
   mkdir graphhopper-data
   
   # 下载中国地图数据
   curl -L -o graphhopper-data/china-latest.osm.pbf https://download.geofabrik.de/asia/china-latest.osm.pbf
   ```

2. **启动 Docker 容器**
   ```bash
   docker-compose up -d
   ```

3. **查看日志**
   ```bash
   docker-compose logs -f graphhopper
   ```

## ✅ 验证服务

### 1. 健康检查

访问 http://localhost:8989/health

应该返回：
```json
{
  "status": "ok",
  "version": "x.x.x"
}
```

### 2. 测试 API

```bash
curl "http://localhost:8989/route?point=115.654,32.168&point=115.664,32.178&vehicle=car"
```

### 3. 查看管理界面

访问 http://localhost:8989

## 🧪 测试导航功能

### 1. 确保后端服务运行

```bash
cd D:\外卖拼单实验\04-backend
npm start
```

### 2. 访问测试页面

打开浏览器访问: http://localhost:3000/test-graphhopper-navigation.html

### 3. 测试流程

1. 点击 **"📍 获取当前位置（天地图）"**
2. 授予浏览器定位权限
3. 点击 **"🧭 开始导航（GraphHopper）"**
4. 查看路线规划和语音导航指引

## 🔧 配置说明

### GraphHopper 配置文件

文件位置: [graphhopper-config.yml](file:///d:/外卖拼单实验/graphhopper-config.yml)

主要配置项：
- `datareader.file`: 地图数据文件路径
- `graph.location`: 图数据存储路径
- `graph.flag_encoders`: 支持的交通方式（car/bike/foot）
- `server.max_waypoints`: 最大途经点数
- `server.max_visited_nodes`: 最大访问节点数

### 后端配置

文件位置: [04-backend/routes/graphhopper.js](file:///d:/外卖拼单实验/04-backend/routes/graphhopper.js#L6)

```javascript
// 切换本地/在线模式
const USE_LOCAL_GRAPHHOPPER = true;  // true=本地, false=在线

// 本地 GraphHopper 地址
const GRAPHHOPPER_BASE_URL = 'http://localhost:8989';
```

## 📊 可用的 API 接口

所有接口都通过后端代理访问: `http://localhost:3000/api/graphhopper/*`

| 接口 | 方法 | 说明 |
|------|------|------|
| `/route` | POST | 路线规划（支持多点） |
| `/navigate` | POST | 导航（含语音） |
| `/geocode` | GET | 地理编码（地址→坐标） |
| `/reverse-geocode` | GET | 逆地理编码（坐标→地址） |
| `/matrix` | POST | 距离矩阵计算 |
| `/tsp` | POST | TSP 优化 |

### 示例请求

#### 路线规划

```bash
curl -X POST http://localhost:3000/api/graphhopper/route \
  -H "Content-Type: application/json" \
  -d '{
    "points": [[115.654, 32.168], [115.664, 32.178]],
    "vehicle": "car",
    "locale": "zh-CN"
  }'
```

#### 导航（含语音）

```bash
curl -X POST http://localhost:3000/api/graphhopper/navigate \
  -H "Content-Type: application/json" \
  -d '{
    "start": [115.654, 32.168],
    "end": [115.664, 32.178],
    "vehicle": "car",
    "locale": "zh-CN"
  }'
```

## 🗺️ 地图数据说明

### 下载其他地区地图

如果需要其他地区的地图数据，访问: https://download.geofabrik.de/

常用下载地址：
- 中国: https://download.geofabrik.de/asia/china-latest.osm.pbf
- 河南: https://download.geofabrik.de/asia/china/henan-latest.osm.pbf
- 固始县: 需要自定义提取

### 更新地图数据

1. 停止服务: `docker-compose down`
2. 删除旧数据: `del graphhopper-data\china-latest.osm.pbf`
3. 重新启动: `start-graphhopper.bat`

## 🛠️ 常用命令

### Docker Compose 命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f graphhopper

# 查看状态
docker-compose ps
```

### Docker 命令

```bash
# 查看容器
docker ps

# 进入容器
docker exec -it graphhopper-server bash

# 查看资源占用
docker stats graphhopper-server
```

## ⚠️ 常见问题

### 1. Docker 未安装

**问题**: 提示 "Docker 未安装或未启动"

**解决**: 
- 下载 Docker Desktop: https://www.docker.com/products/docker-desktop
- 安装并启动 Docker Desktop

### 2. 端口被占用

**问题**: 提示 "端口 8989 已被占用"

**解决**:
```bash
# 查看占用端口的进程
netstat -ano | findstr :8989

# 终止进程
taskkill /F /PID <进程ID>
```

### 3. 地图数据下载失败

**问题**: 提示 "地图数据下载失败"

**解决**:
- 手动下载: https://download.geofabrik.de/asia/china-latest.osm.pbf
- 放置到: `graphhopper-data/china-latest.osm.pbf`
- 重新启动服务

### 4. 服务初始化慢

**问题**: 首次启动需要很长时间

**原因**: 需要加载和索引地图数据

**解决**: 
- 耐心等待 5-10 分钟
- 查看日志确认进度: `docker-compose logs -f graphhopper`
- 等待看到 "Server started" 提示

### 5. 路线规划失败

**问题**: API 返回错误

**检查**:
1. GraphHopper 服务是否正常运行: http://localhost:8989/health
2. 后端服务是否正常运行: http://localhost:3000/api/health
3. 坐标是否在地图范围内（中国境内）

## 📈 性能优化

### 调整内存分配

编辑 [docker-compose.yml](file:///d:/外卖拼单实验/docker-compose.yml#L10):

```yaml
environment:
  - JAVA_OPTS=-Xmx4g -Xms4g  # 增加到 4GB
```

### 调整最大节点数

编辑 [graphhopper-config.yml](file:///d:/外卖拼单实验/graphhopper-config.yml#L23):

```yaml
server:
  max_visited_nodes: 2000000  # 增加到 200 万
```

## 🔐 安全建议

1. **不要暴露到公网** - 本地服务仅供内部使用
2. **定期更新** - 保持 Docker 镜像最新
3. **备份数据** - 定期备份地图数据和配置

## 📞 技术支持

如有问题，请检查：
1. Docker 是否正常运行
2. GraphHopper 容器是否启动: `docker-compose ps`
3. 服务日志: `docker-compose logs -f graphhopper`
4. 端口是否被占用: `netstat -ano | findstr :8989`

---

**项目状态：✅ 本地 GraphHopper 部署方案已就绪，等待启动测试**
