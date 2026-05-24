# [OPEN] merchant-delivery-miss

## 症状
- 商家端完成接单与出餐后，绑定该店铺的商家自配送员在骑手端“待配送/配送中”都看不到订单。

## 期望
- 只要订单已进入店铺自配送链路，且骑手账号绑定了该店铺，就应在骑手端“待配送”看到该单。

## 当前证据
- 骑手端页面已进入“本店订单”模式。
- 骑手端轮询报错 `isMerchantDeliveryUser is not defined` 已修复。
- 仍然看不到订单，说明更可能是后端返回为空或订单未真正写入 `self_delivery`。

## 可证伪假设
1. `merchant_delivery(商家自配送员)` 的 `bound_merchant_id(绑定店铺ID)` 为空或不等于订单 `merchant_id(商家ID)`。
2. 商家端虽然出餐了，但订单 `supermarket_delivery_mode(店铺配送模式)` 实际不是 `self_delivery`。
3. 订单状态没有停在 `3(待配送)`，而是被写成了别的状态，导致 `buildMerchantDeliveryVisibleOrderWhere()` 命不中。
4. `/order/rider-orders` 后端接口命中了，但返回结果在服务端就已经是空数组。
5. 骑手端当前登录的并不是预期那条 `merchant_delivery(商家自配送员)` 用户记录。

## 调试计划
1. 在后端 `getRiderOrders()` 增加只读插桩，记录当前骑手、绑定店铺、查询条件、返回数量。
2. 在后端 `prepareOrder()` 增加只读插桩，记录出餐后订单状态、配送模式、店铺与责任人字段。
3. 用户复现一次后收集日志，确认以上假设的真伪。
