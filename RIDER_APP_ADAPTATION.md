# 骑手端对接说明（派单模式）

## 变更点

- 后端不再提供“抢单”能力：不再对外提供 `POST /api/order/rider-accept`
- `GET /api/order/available` 在派单模式下仅返回骑手自己的订单（状态 5/6），用于首页统计展示
- 骑手订单列表请使用 `GET /api/order/rider-orders`
- 位置上报使用 `POST /api/rider/location/report`

## 建议调整（骑手端 APP）

### 1) API 文件

- 删除或停用 `acceptOrder()`（原 `/order/rider-accept`）
- `getAvailableOrders()` 保留用于首页统计即可（接口仍存在，但只返回自己的 5/6 订单）
- 订单列表页统一使用 `getRiderOrders({ status })`

### 2) 页面逻辑

- 首页 `pendingOrders` 不再按 1/4 过滤；改为展示 `status === 5` 的“配送中订单”
- 订单列表页按钮仅保留 `status === 5` 的“确认送达”
- 在线/休息切换时调用 `POST /api/order/rider-status` 同步到后端（骑手端已有 `updateRiderStatus()` 封装）

### 3) 位置上报（可选）

- 在首页 `onShow` 或全局 `App.vue` 定时调用 `uni.getLocation`，将 `latitude/longitude` 上报到 `POST /api/rider/location/report`
- 若获取定位失败，建议仅跳过本次上报并保持不崩溃

