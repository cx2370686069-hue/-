# GraphHopper 集成配置说明

## 📋 概述

本项目已成功集成 **天地图** 和 **GraphHopper** 两种导航服务：

- **天地图API**：用于地理定位（获取用户坐标）
- **GraphHopper API**：用于路线规划和语音导航

## 🚀 已完成的工作

### 1. 后端集成

#### 创建的文件：
- [`routes/graphhopper.js`](file:///d:/外卖拼单实验/04-backend/routes/graphhopper.js) - GraphHopper API 代理接口
- [`03-frontend/test-graphhopper-navigation.html`](file:///d:/外卖拼单实验/03-frontend/test-graphhopper-navigation.html) - 集成测试页面

#### 修改的文件：
- [`server.js`](file:///d:/外卖拼单实验/04-backend/server.js) - 注册 GraphHopper 路由

### 2. API 接口

#### GraphHopper 路由

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/graphhopper/route` | POST | 路线规划（支持多点） |
| `/api/graphhopper/navigate` | POST | 导航（支持语音） |
| `/api/graphhopper/geocode` | GET | 地理编码（地址→坐标） |
| `/api/graphhopper/reverse-geocode` | GET | 逆地理编码（坐标→地址） |
| `/api/graphhopper/matrix` | POST | 距离矩阵计算 |
| `/api/graphhopper/tsp` | POST | 旅行商问题优化 |

#### 天地图路由

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tianditu/drive` | POST | 驾车路线规划 |
| `/api/tianditu/geocode` | GET | 地理编码 |
| `/api/tianditu/reverse-geocode` | GET | 逆地理编码 |
| `/api/tianditu/search` | GET | 地名搜索 |

## ⚙️ 配置步骤

### 1. 获取 GraphHopper API Key

1. 访问 [GraphHopper 官网](https://www.graphhopper.com/)
2. 注册账号并登录
3. 创建新应用，获取 API Key
4. 将 API Key 填入 [`routes/graphhopper.js`](file:///d:/外卖拼单实验/04-backend/routes/graphhopper.js#L6)：

```javascript
const GRAPHHOPPER_API_KEY = 'YOUR_GRAPHHOPPER_API_KEY';
```

### 2. 重启服务器

修改配置后，需要重启服务器：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
cd D:\外卖拼单实验\04-backend
npm start
```

## 🧪 测试流程

### 方法 1：使用测试页面

1. 访问测试页面：http://localhost:3000/test-graphhopper-navigation.html
2. 点击 **"📍 获取当前位置（天地图）"** 按钮
3. 授予浏览器定位权限
4. 输入终点坐标（或使用默认值）
5. 点击 **"🧭 开始导航（GraphHopper）"** 按钮
6. 查看路线规划和语音导航指引

### 方法 2：使用 API 直接测试

#### 测试路线规划

```bash
curl -X POST http://localhost:3000/api/graphhopper/route \
  -H "Content-Type: application/json" \
  -d '{
    "points": [[115.654, 32.168], [115.664, 32.178]],
    "vehicle": "car",
    "locale": "zh-CN"
  }'
```

#### 测试导航（含语音）

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

## 📊 完整工作流程

```
用户下单
    ↓
天地图定位（获取用户坐标）
    ↓
GraphHopper 路线规划
    ↓
返回路线 + 语音导航指引
    ↓
司机端显示导航
```

## 🎯 核心优势

### GraphHopper vs 天地图

| 特性 | GraphHopper | 天地图 |
|------|-------------|--------|
| 路线规划 | ✅ | ✅ |
| 语音导航 | ✅ | ❌ |
| 多点优化 | ✅ | ❌ |
| 距离矩阵 | ✅ | ❌ |
| TSP 优化 | ✅ | ❌ |
| 本地部署 | ✅ | ❌ |
| 中文支持 | ✅ | ✅ |

## 🔧 高级功能

### 1. 多点路线规划

```javascript
POST /api/graphhopper/route
{
  "points": [
    [115.654, 32.168],  // 起点
    [115.660, 32.170],  // 途经点1
    [115.665, 32.175],  // 途经点2
    [115.670, 32.180]   // 终点
  ],
  "vehicle": "car",
  "locale": "zh-CN"
}
```

### 2. TSP 优化（自动排序）

```javascript
POST /api/graphhopper/tsp
{
  "points": [
    [115.654, 32.168],
    [115.660, 32.170],
    [115.665, 32.175],
    [115.670, 32.180]
  ],
  "vehicle": "car",
  "locale": "zh-CN"
}
```

### 3. 距离矩阵计算

```javascript
POST /api/graphhopper/matrix
{
  "points": [
    [115.654, 32.168],
    [115.660, 32.170],
    [115.665, 32.175]
  ],
  "vehicle": "car",
  "out_arrays": ["distances", "times"]
}
```

## 📝 注意事项

1. **API Key 安全**：不要将 API Key 提交到公共代码仓库
2. **配额限制**：GraphHopper 免费版有请求次数限制
3. **本地部署**：如需更高性能，可本地部署 GraphHopper 服务器
4. **语音功能**：语音导航指引已集成，前端可使用 Web Speech API 播放

## 🚀 下一步建议

1. 配置 GraphHopper API Key
2. 测试完整导航流程
3. 集成到司机端页面
4. 添加语音播报功能（使用 Web Speech API）
5. 优化路线规划算法（结合 TSP 和距离矩阵）

## 📞 技术支持

如有问题，请检查：
1. 后端服务是否正常运行
2. GraphHopper API Key 是否正确配置
3. 网络连接是否正常
4. 浏览器控制台是否有错误信息

---

**项目状态：✅ GraphHopper 集成完成，等待 API Key 配置**
