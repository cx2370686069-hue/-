<template>
  <view class="container">
    <view class="content">
      <text class="title">骑手端测试页面</text>
      <text class="subtitle">项目运行正常！✅</text>
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
  background: linear-gradient(135deg, #1890ff, #40a9ff);
}

.content {
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 20rpx;
}

.subtitle {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
  display: block;
}
</style>
