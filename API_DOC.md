# 跑腿后端 API 接口文档

## 基础信息

- **基础 URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **认证方式**: JWT Token（在请求头中携带 `Authorization: Bearer <token>`）

---

## 目录

1. [认证接口](#认证接口)
2. [商家接口](#商家接口)
3. [订单接口](#订单接口)
4. [地址接口](#地址接口)
5. [通用接口](#通用接口)

---

## 认证接口

### 1. 用户注册

**POST** `/auth/register`

**请求参数**:
```json
{
  "phone": "13800138000",
  "password": "123456",
  "nickname": "张三",
  "role": "user"  // user-用户，merchant-商家，rider-骑手
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "phone": "13800138000",
      "nickname": "张三",
      "avatar": null,
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. 用户登录

**POST** `/auth/login`

**请求参数**:
```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "phone": "13800138000",
      "nickname": "张三",
      "avatar": null,
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. 获取当前用户信息

**GET** `/auth/me`

**请求头**: `Authorization: Bearer <token>`

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "phone": "13800138000",
    "nickname": "张三",
    "avatar": null,
    "role": "user"
  }
}
```

---

### 4. 更新用户信息

**PUT** `/auth/profile`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
```json
{
  "nickname": "新昵称",
  "avatar": "头像 URL"
}
```

---

## 商家接口

### 1. 获取商家列表

**GET** `/merchant/list?page=1&limit=10`

**可选筛选参数（镇上首页类目筛店）**:
- `business_scope=town_food`：只取乡镇外卖商家
- `town_code=<乡镇编码>` 或 `town_name=<乡镇名称>`：限定乡镇范围（二选一即可）
- `category=<主营类目>`：店铺主营类目（受控值，来自 `/common/merchant-primary-categories`）

**镇上首页类目筛店示例**:
```
/merchant/list?business_scope=town_food&town_code=410000xxxx&category=龙虾烧烤&page=1&limit=10
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

---

### 2. 获取商家详情

**GET** `/merchant/detail/:id`

---

### 3. 获取商家商品分类

**GET** `/merchant/categories?merchant_id=1`

---

### 4. 获取商家商品列表

**GET** `/merchant/products?merchant_id=1&category_id=1`

---

### 5. 创建店铺（商家端）

**POST** `/merchant/create`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
```json
{
  "name": "张三快餐店",
  "description": "美味快餐",
  "phone": "13800138000",
  "address": "XX 县 XX 镇 XX 路",
  "delivery_radius": 5.0,
  "min_price": 15.00,
  "delivery_fee": 3.00
}
```

---

## 通用接口

### 1. 获取乡镇/区域字典

**GET** `/common/service-areas?area_type=town&enabled=true`

---

### 2. 获取店铺主营类目（受控字典）

**GET** `/common/merchant-primary-categories`

**响应示例**:
```json
{
  "code": 200,
  "data": ["美食","甜点饮品","龙虾烧烤","鲜花蛋糕","汉堡炸鸡","跑腿代购"]
}
```

### 6. 获取我的店铺（商家端）

**GET** `/merchant/my`

**请求头**: `Authorization: Bearer <token>`

---

### 7. 创建商品分类（商家端）

**POST** `/merchant/category`

**请求参数**:
```json
{
  "name": "热菜",
  "sort": 1
}
```

---

### 8. 创建商品（商家端）

**POST** `/merchant/product`

**请求参数**:
```json
{
  "name": "宫保鸡丁",
  "description": "经典川菜",
  "price": 28.00,
  "original_price": 35.00,
  "category_id": 1,
  "images": ["url1", "url2"],
  "stock": 999
}
```

---

### 9. 获取店铺订单（商家端）

**GET** `/merchant/orders?status=1`

---

## 订单接口

### 1. 创建订单（用户端）

**POST** `/order/create`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
```json
{
  "merchant_id": 1,
  "type": "takeout",  // takeout-外卖，errand-跑腿
  "products_info": [
    {"id": 1, "name": "宫保鸡丁", "price": 28, "quantity": 1}
  ],
  "total_amount": 28.00,
  "delivery_fee": 3.00,
  "package_fee": 1.00,
  "discount_amount": 0.00,
  "delivery_type": 1,  // 1-配送，2-自取
  "contact_phone": "13800138000",
  "contact_name": "张三",
  "delivery_address": {
    "province": "XX 省",
    "city": "XX 市",
    "district": "XX 县",
    "street": "XX 街道",
    "detail": "XX 小区 X 栋 X 单元"
  },
  "delivery_latitude": 30.123456,
  "delivery_longitude": 120.123456,
  "remark": "不要辣椒"
}
```

---

### 2. 支付订单（用户端）

**POST** `/order/pay`

**请求参数**:
```json
{
  "order_id": 1
}
```

---

### 3. 获取我的订单（用户端）

**GET** `/order/my?status=1&type=takeout`

---

### 4. 获取订单详情

**GET** `/order/detail/:id`

---

### 5. 取消订单（用户端）

**POST** `/order/cancel`

**请求参数**:
```json
{
  "order_id": 1,
  "reason": "不想要了"
}
```

---

### 6. 商家接单

**POST** `/order/accept`

**请求参数**:
```json
{
  "order_id": 1
}
```

---

### 7. 商家拒单

**POST** `/order/reject`

**请求参数**:
```json
{
  "order_id": 1,
  "reason": "食材不足"
}
```

---

### 8. 商家备货完成

**POST** `/order/prepare`

**请求参数**:
```json
{
  "order_id": 1
}
```

---

### 9. 获取骑手工作台订单（骑手端）

**GET** `/order/available`

说明：当前项目不启用抢单，该接口仅返回骑手自己的工作台订单（状态 5/6）。

---

### 10. 骑手确认送达

**POST** `/order/confirm-delivery`

**请求参数**:
```json
{
  "order_id": 1
}
```

### 11. 获取我的配送订单（骑手端）

**GET** `/order/rider-orders?status=5`

---

### 12. 更新骑手状态

**POST** `/order/rider-status`

**请求参数**:
```json
{
  "status": 1  // 0-休息，1-接单中
}
```

---

## 地址接口

### 1. 获取地址列表

**GET** `/address/list`

---

### 2. 获取默认地址

**GET** `/address/default`

---

### 3. 创建地址

**POST** `/address/create`

**请求参数**:
```json
{
  "contact_name": "张三",
  "contact_phone": "13800138000",
  "province": "XX 省",
  "city": "XX 市",
  "district": "XX 县",
  "street": "XX 街道",
  "detail": "XX 小区 X 栋 X 单元",
  "latitude": 30.123456,
  "longitude": 120.123456,
  "is_default": true
}
```

---

### 4. 更新地址

**PUT** `/address/update`

**请求参数**:
```json
{
  "id": 1,
  "contact_name": "新联系人",
  "is_default": true
}
```

---

### 5. 删除地址

**DELETE** `/address/delete/:id`

---

### 6. 设置默认地址

**POST** `/address/set-default`

**请求参数**:
```json
{
  "id": 1
}
```

---

## 订单状态说明

| 状态码 | 状态名称 | 说明 |
|--------|----------|------|
| 0 | 待支付 | 用户创建订单后未支付 |
| 1 | 待接单 | 用户已支付，等待商家接单 |
| 2 | 已接单 | 商家已接单 |
| 3 | 备货中 | 商家正在备货 |
| 4 | 备货完成 | 商家备货完成，等待骑手 |
| 5 | 配送中 | 骑手正在配送 |
| 6 | 已完成 | 订单完成 |
| 7 | 已取消 | 订单已取消 |

---

## 常见错误码

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或 Token 失效 |
| 403 | 没有权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 快速开始

### 1. 用户注册登录

```bash
# 注册用户
POST http://localhost:3000/api/auth/register
{
  "phone": "13800138000",
  "password": "123456",
  "nickname": "张三"
}

# 返回 token，后续请求在请求头携带
Authorization: Bearer <token>
```

### 2. 商家创建店铺

```bash
# 先注册商家账号（role=merchant）
POST http://localhost:3000/api/auth/register
{
  "phone": "13800138001",
  "password": "123456",
  "nickname": "商家李四",
  "role": "merchant"
}

# 登录获取 token
POST http://localhost:3000/api/auth/login

# 创建店铺
POST http://localhost:3000/api/merchant/create
{
  "name": "李四快餐店",
  "phone": "13800138001",
  "address": "XX 县 XX 镇"
}
```

### 3. 骑手注册

```bash
# 注册骑手账号（role=rider）
POST http://localhost:3000/api/auth/register
{
  "phone": "13800138002",
  "password": "123456",
  "nickname": "骑手王五",
  "role": "rider"
}
```
