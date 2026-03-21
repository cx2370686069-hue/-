# 县城外卖（调度中心）对接说明

## 业务分流

- `order_type=county`：县城外卖 → 推送到调度中心（外卖拼单实验）→ 人工派单（货车司机/线路）
- `order_type=town`：乡镇外卖 → 系统自动分配对应乡镇站长 → 站长配送到户

## 环境变量

- `DISPATCH_CENTER_BASE_URL`：调度中心服务地址，例如 `http://127.0.0.1:3100`
- `DISPATCH_CENTER_TIMEOUT_MS`：推送超时毫秒数（默认 5000）

注意：调度中心项目默认端口是 3000，本系统后端也默认 3000，请避免端口冲突。

## 推送时机

商家发货接口：`POST /api/order/deliver`

当订单 `order_type=county` 且 `status=4`（备货完成）时，后端会推送至调度中心：

`POST {DISPATCH_CENTER_BASE_URL}/api/orders`

Payload（与调度中心保持一致）：

- `id`：本系统订单 id（字符串）
- `restaurant`：商家名称
- `restaurant_lat/restaurant_lon`：商家经纬度（可空）
- `customer_town`：客户乡镇（必填）
- `customer_lat/customer_lon`：客户经纬度（可空）
- `order_type`：固定为 `county`

## 站长绑定

乡镇外卖自动分配的前提是站长账号已绑定乡镇：

`POST /api/rider/station/bind { town }`

