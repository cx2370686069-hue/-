# 🚀 跑腿后端 - 快速开始指南

## ✅ 服务已启动成功！

你的后端服务现在正在运行：
- **访问地址**: http://localhost:3000
- **API 地址**: http://localhost:3000/api
- **数据库**: gushi_waimai（已自动创建 7 张表）

---

## 📝 快速测试（3 分钟上手）

### 方式一：运行测试脚本（推荐）

在项目目录下双击运行：
```
test.bat
```

会自动执行以下测试：
1. ✅ 健康检查
2. ✅ 注册用户
3. ✅ 用户登录
4. ✅ 注册商家
5. ✅ 注册骑手

### 方式二：使用 Postman/Apifox 测试

#### 1️⃣ 测试健康检查
```
GET http://localhost:3000/api/health
```

预期响应：
```json
{
  "code": 200,
  "message": "服务运行正常",
  "timestamp": "2026-03-09T..."
}
```

---

#### 2️⃣ 注册用户
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "123456",
  "nickname": "张三"
}
```

预期响应：
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "phone": "13800138000",
      "nickname": "张三",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**重要**：保存返回的 `token`，后续接口需要用到！

---

#### 3️⃣ 用户登录
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "123456"
}
```

---

#### 4️⃣ 创建地址（需要 Token）
```
POST http://localhost:3000/api/address/create
Content-Type: application/json
Authorization: Bearer <你的 token>

{
  "contact_name": "张三",
  "contact_phone": "13800138000",
  "province": "XX 省",
  "city": "XX 市",
  "district": "XX 县",
  "street": "XX 街道",
  "detail": "XX 小区 1 栋 1 单元",
  "is_default": true
}
```

---

#### 5️⃣ 注册商家账号
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "phone": "13800138001",
  "password": "123456",
  "nickname": "美味快餐店",
  "role": "merchant"
}
```

---

#### 6️⃣ 商家登录并创建店铺
```
# 先登录
POST http://localhost:3000/api/auth/login
{
  "phone": "13800138001",
  "password": "123456"
}

# 用返回的 token 创建店铺
POST http://localhost:3000/api/merchant/create
Authorization: Bearer <商家 token>
Content-Type: application/json

{
  "name": "美味快餐店",
  "description": "正宗家常菜",
  "phone": "13800138001",
  "address": "XX 县 XX 镇 XX 路 1 号",
  "delivery_radius": 5.0,
  "min_price": 15.00,
  "delivery_fee": 3.00
}
```

---

#### 7️⃣ 注册骑手账号
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "phone": "13800138002",
  "password": "123456",
  "nickname": "闪电骑手",
  "role": "rider"
}
```

---

## 📱 前端对接流程

### 用户端对接步骤

1. **登录注册** → 保存 token 到 localStorage
   ```javascript
   localStorage.setItem('token', response.data.token);
   ```

2. **请求时携带 Token**
   ```javascript
   axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
   ```

3. **获取商家列表**
   ```javascript
   GET /api/merchant/list
   ```

4. **获取商品列表**
   ```javascript
   GET /api/merchant/products?merchant_id=1
   ```

5. **创建订单**
   ```javascript
   POST /api/order/create
   {
     "merchant_id": 1,
     "order_type": "county", // county-县城外卖（调度中心派单）/ town-乡镇外卖（站长直送）
     "customer_town": "陈淋子镇", // 乡镇外卖必填；县城外卖用于调度中心聚类
     "products_info": [...],
     "total_amount": 28.00,
     "delivery_fee": 3.00,
     ...
   }
   ```

6. **支付订单**
   ```javascript
   POST /api/order/pay
   {
     "order_id": 1,
     "payMethod": "mock" // mock/wechat/alipay/balance
   }
   ```

   - 默认模式（`PAYMENT_MODE=mock`）：会自动完成“预下单 + 支付成功回调”，并返回 `data.order` 与 `data.transaction`
   - 网关模式（`PAYMENT_MODE=gateway`）：仅返回预下单信息（`out_trade_no/amount/channel`），支付成功后由 `/api/pay/*/notify` 回调驱动订单从 0→1

7. **查看订单**
   ```javascript
   GET /api/order/my
   ```

---

### 商家端对接步骤

1. **商家登录**（role="merchant"）

2. **创建店铺**
   ```javascript
   POST /api/merchant/create
   ```

3. **创建商品分类**
   ```javascript
   POST /api/merchant/category
   {
     "name": "热菜"
   }
   ```

4. **创建商品**
   ```javascript
   POST /api/merchant/product
   {
     "name": "宫保鸡丁",
     "price": 28.00,
     "category_id": 1,
     ...
   }
   ```

5. **获取订单列表**
   ```javascript
   GET /api/merchant/orders
   ```

6. **接单/拒单/备货**
   ```javascript
   POST /api/order/accept  // 接单
   POST /api/order/reject  // 拒单
   POST /api/order/prepare // 第一次：2→3（开始备货）；第二次：3→4（备货完成）
   ```

7. **发货/派单规则（关键）**
   - `order_type=town`：商家 `POST /api/order/deliver` 时，系统自动分配对应乡镇站长（stationmaster），订单变为 5（配送中）
   - `order_type=county`：商家 `POST /api/order/deliver` 时，订单会推送到调度中心（外卖拼单实验）进行人工派单；本系统订单状态保持 4（备货完成），并写入 dispatch_* 字段

---

### 骑手端对接步骤

1. **骑手注册登录**（role="rider"）

2. **查看已派单（配送中/已完成）**
   ```javascript
   GET /api/order/rider-orders
   ```

3. **骑手工作台订单（用于统计展示）**
   ```javascript
   GET /api/order/available
   ```
   - 当前项目不启用“抢单”，该接口返回骑手自己的订单（状态 5/6），用于骑手端首页统计与展示

4. **确认送达**
   ```javascript
   POST /api/order/confirm-delivery
   {
     "order_id": 1
   }
   ```

5. **位置上报（可选，用于调度端/商家查看实时位置）**
   ```javascript
   POST /api/rider/location/report
   {
     "latitude": 32.123456,
     "longitude": 115.123456
   }
   ```

6. **查看在线骑手位置（商家/骑手）**
   ```javascript
   GET /api/rider/locations?minutes=10
   ```

7. **绑定为乡镇站长（每个乡镇仅允许一个站长）**
   ```javascript
   POST /api/rider/station/bind
   {
     "town": "陈淋子镇"
   }
   ```

---

## 🎯 订单状态流转图

```
用户下单
   ↓
[0-待支付] → 用户取消 → [7-已取消]
   ↓ 支付
[1-待接单] → 用户取消 → [7-已取消]
   ↓ 商家接单
[2-已接单]
   ↓ 商家备货
[3-备货中]
   ↓ 备货完成
[4-备货完成] → 等待骑手
   ↓ 商家派单（分配骑手）
[5-配送中]
   ↓ 送达
[6-已完成]
```

---

## 🛠️ 常用命令

### 启动服务
```bash
npm run dev    # 开发模式（推荐）
npm start      # 生产模式
```

### 停止服务
在运行服务的终端按 `Ctrl+C`

### 重启服务
在终端输入 `rs` 然后回车

---

## 📊 数据库表说明

已自动创建 8 张表：

1. **users** - 用户表（用户/商家/骑手）
2. **merchants** - 商家店铺表
3. **product_categories** - 商品分类表
4. **products** - 商品表
5. **orders** - 订单表
6. **order_logs** - 订单日志表
7. **addresses** - 用户地址表
8. **payment_transactions** - 支付交易表（预下单/回调幂等/对账）

查看数据库：
```bash
# 登录 MySQL
D:\MySQL\mysql-8.0.43-winx64\bin\mysql.exe -u root -p123456

# 使用数据库
use gushi_waimai;

# 查看所有表
show tables;

# 查看用户表数据
select * from users;
```

---

## 🔧 常见问题

### Q1: 如何停止服务？
A: 在运行服务的终端按 `Ctrl+C`

### Q2: 如何重新启动服务？
A: 在项目目录下运行 `npm run dev`

### Q3: Token 过期了怎么办？
A: 重新登录获取新 token，token 有效期 7 天

### Q4: 如何清空测试数据？
A: 登录 MySQL 执行：
```sql
use gushi_waimai;
DELETE FROM addresses;
DELETE FROM order_logs;
DELETE FROM orders;
DELETE FROM products;
DELETE FROM product_categories;
DELETE FROM merchants;
DELETE FROM users;
```

---

## 📖 完整文档

- **API_DOC.md** - 详细接口文档
- **README.md** - 项目说明文档
- **database.sql** - 数据库初始化脚本

---

## 🎉 下一步

1. ✅ 后端服务已启动
2. ⏳ 使用 Postman 或 test.bat 测试接口
3. ⏳ 开始对接前端（用户端/商家端/骑手端）

**祝你开发顺利！** 🚀
