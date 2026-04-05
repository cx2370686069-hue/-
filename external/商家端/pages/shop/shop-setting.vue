<template>
  <view class="wrap"><text class="t">正在跳转店铺设置…</text></view>
</template>

<script>
export default {
  onLoad() {
    uni.redirectTo({ url: '/pages/shop/index' })
  }
}
</script>

<style scoped>
.wrap {
  padding: 40rpx;
}
.t {
  font-size: 28rpx;
  color: #999;
}
</style>
