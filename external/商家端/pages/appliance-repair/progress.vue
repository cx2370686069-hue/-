<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
      <text class="nav-title">维修进度</text>
    </view>
    <view class="content">
      <view class="empty" v-if="list.length === 0">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无报修记录</text>
        <text class="empty-tip">提交报修后可以在这里查看进度</text>
      </view>
      <view class="list" v-else>
        <view class="card" v-for="item in list" :key="item.id">
          <view class="card-row">
            <text class="card-type">{{ item.type }}</text>
            <text class="card-status">{{ item.status }}</text>
          </view>
          <text class="card-desc">{{ item.desc }}</text>
          <text class="card-time">{{ item.time }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      list: []
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.container { background: #f5f5f5; min-height: 100vh; }
.nav-bar {
  padding-top: calc(44rpx + env(safe-area-inset-top));
  padding-bottom: 24rpx;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  display: flex;
  align-items: center;
}
.nav-left { display: flex; align-items: center; }
.nav-back { font-size: 48rpx; color: #fff; font-weight: 300; margin-right: 10rpx; }
.nav-back-text { font-size: 36rpx; font-weight: bold; color: #fff; }
.nav-title { font-size: 36rpx; font-weight: bold; color: #fff; margin-left: 20rpx; }

.content { padding: 24rpx; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 40rpx; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 30rpx; color: #999; margin-bottom: 12rpx; }
.empty-tip { font-size: 24rpx; color: #ccc; }

.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 20rpx; }
.card-row { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.card-type { font-size: 30rpx; font-weight: bold; color: #333; }
.card-status { font-size: 26rpx; color: #FF6B35; }
.card-desc { font-size: 26rpx; color: #666; display: block; margin-bottom: 8rpx; }
.card-time { font-size: 24rpx; color: #999; }
</style>
