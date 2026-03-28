# 跑腿后端 - 县城乡镇外卖 APP 后端服务

这是一个为县城乡镇外卖跑腿 APP 设计的后端服务项目。

---

## 📋 项目功能

### 用户端
- ✅ 用户注册/登录
- ✅ 浏览商家和商品
- ✅ 创建订单（外卖/跑腿）
- ✅ 支付订单
- ✅ 查看订单状态
- ✅ 地址管理
- ✅ 订单评价

### 商家端
- ✅ 店铺管理
- ✅ 商品分类管理
- ✅ 商品管理
- ✅ 订单管理（接单/拒单/备货）

### 骑手端
- ✅ 抢单/接单
- ✅ 配送管理
- ✅ 收入统计
- ✅ 状态切换（接单中/休息）

---

## 🛠️ 技术栈

- **运行环境**: Node.js 14+
- **Web 框架**: Express
- **数据库**: MySQL 5.7+ / 8.0+
- **ORM**: Sequelize
- **认证**: JWT
- **密码加密**: bcryptjs

---

## 📦 安装步骤

### 1. 环境准备

确保已安装：
- Node.js (推荐 16.x 或更高版本)
- MySQL 数据库

### 2. 安装依赖

在项目目录下执行：

```bash
npm install
```

### 3. 配置数据库

编辑 `.env` 文件，修改数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=gushi_waimai
```

### 4. 创建数据库

方式一：自动创建（推荐）
- 项目启动时会自动创建数据库和表

方式二：手动创建
```bash
# 登录 MySQL
mysql -u root -p

# 执行初始化脚本
source database.sql
```

---

## 🚀 启动项目

### 开发模式（自动重启）

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

启动成功后会显示：
```
✅ 数据库表同步完成
🚀 跑腿后端服务已启动
访问地址：http://localhost:3000
API 地址：http://localhost:3000/api
```

---

## 📖 API 文档

详细的 API 接口文档请查看：[API_DOC.md](./API_DOC.md)

### 快速测试

#### 1. 健康检查
```bash
GET http://localhost:3000/api/health
```

#### 2. 用户注册
```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "123456",
  "nickname": "张三"
}
```

#### 3. 用户登录
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "123456"
}
```

---

## 📁 项目结构

```
跑腿后端/
├── config/              # 配置文件
│   └── database.js     # 数据库配置
├── controllers/         # 控制器（业务逻辑）
│   ├── authController.js
│   ├── merchantController.js
│   ├── orderController.js
│   └── addressController.js
├── middleware/          # 中间件
│   ├── auth.js         # 认证中间件
│   └── errorHandler.js # 错误处理
├── models/              # 数据模型
│   ├── User.js
│   ├── Merchant.js
│   ├── Product.js
│   ├── Order.js
│   └── index.js
├── routes/              # 路由
│   ├── auth.js
│   ├── merchant.js
│   ├── order.js
│   └── address.js
├── utils/               # 工具函数
│   └── helpers.js
├── uploads/             # 上传文件目录
├── src/
│   └── index.js        # 入口文件
├── .env                # 环境变量配置
├── database.sql        # 数据库初始化脚本
├── API_DOC.md          # API 接口文档
├── package.json
└── README.md
```

---

## 🔑 核心功能说明

### 1. 用户体系

系统支持三种角色：
- `user` - 普通用户（点餐）
- `merchant` - 商家（开店）
- `rider` - 骑手（配送）

注册时通过 `role` 参数区分：
```json
{
  "phone": "13800138000",
  "password": "123456",
  "role": "user"  // merchant 或 rider
}
```

### 2. 订单流程

```
待支付 (0) 
  ↓ 用户支付
待接单 (1)
  ↓ 商家接单
已接单 (2)
  ↓ 商家备货
备货中 (3)
  ↓ 备货完成
备货完成 (4)
  ↓ 骑手抢单
配送中 (5)
  ↓ 送达
已完成 (6)
```

取消流程：
- 待支付状态 → 用户可直接取消
- 待接单状态 → 用户可申请取消
- 其他状态 → 需要客服介入

### 3. JWT 认证

所有需要登录的接口，需要在请求头携带 Token：

```
Authorization: Bearer <token>
```

Token 通过登录接口获取，有效期 7 天。

---

## 🔧 常见问题

### 1. 数据库连接失败

检查 `.env` 文件中的数据库配置是否正确，确保 MySQL 服务已启动。

### 2. 端口被占用

修改 `.env` 文件中的 `PORT` 值：
```env
PORT=3001
```

### 3. 跨域问题

项目已配置 CORS，允许所有来源访问。如需限制，修改 `src/index.js` 中的 CORS 配置。

---

## 📝 开发说明

### 添加新接口

1. 在 `controllers/` 目录创建控制器文件
2. 在 `routes/` 目录创建路由文件
3. 在 `routes/index.js` 中挂载路由

### 添加新模型

1. 在 `models/` 目录创建模型文件
2. 在 `models/index.js` 中定义关系

---

## 📞 技术支持

如有问题，请查看：
- [API_DOC.md](./API_DOC.md) - 详细接口文档
- [database.sql](./database.sql) - 数据库脚本

---

## 📄 许可证

MIT License

---

**祝：项目顺利！🚀**
