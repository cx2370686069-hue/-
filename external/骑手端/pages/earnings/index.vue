<template>
  <view class="container">
    <view class="empty-state">
      <text class="empty-icon">💰</text>
      <text class="empty-text">订单收入汇总</text>
      <text class="empty-tip">当前未开放到账时间与收入流水展示，相关能力待结算接口完善后开放。</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #999;
}
</style>
