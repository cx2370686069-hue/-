<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
      <text class="nav-title">数码配件</text>
    </view>
    <view class="option-grid">
      <view class="option-card option-card-1" @click="goGoods">
        <text class="option-emoji">🎧</text>
        <text class="option-title">浏览数码配件</text>
        <text class="option-desc">耳机/数据线/充电器/保护壳等</text>
      </view>
      <view class="option-card option-card-2" @click="goInquiry">
        <text class="option-emoji">📋</text>
        <text class="option-title">我要询价</text>
        <text class="option-desc">批量采购、定制配件</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    goBack() {
      uni.switchTab({ url: '/pages/home/index' })
    },
    goGoods() {
      uni.navigateTo({ url: '/pages/digital-parts/goods' })
    },
    goInquiry() {
      uni.showToast({ title: '敬请期待', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #fff;
  min-height: 100vh;
  padding: 40rpx;
  padding-top: 0;
  padding-bottom: 40rpx;
  box-sizing: border-box;
}

.nav-bar {
  width: calc(100% + 80rpx);
  margin-left: -40rpx;
  margin-top: -40rpx;
  padding: 44rpx 28rpx 36rpx;
  padding-left: 48rpx;
  padding-top: calc(44rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.nav-left {
  display: flex;
  align-items: center;
  padding-top: 32rpx;
}
.nav-back {
  font-size: 64rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
  margin-right: 10rpx;
}
.nav-back-text {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}
.nav-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  margin-left: 24rpx;
  padding-top: 32rpx;
}

.option-grid {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  padding-top: 80rpx;
  margin-left: -40rpx;
  margin-right: -40rpx;
  width: calc(100% + 80rpx);
  padding-left: 40rpx;
  padding-right: 40rpx;
  box-sizing: border-box;
}

.option-card {
  width: 100%;
  min-height: 280rpx;
  border-radius: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1);
  padding: 40rpx;
  box-sizing: border-box;
}
.option-card-1 {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
}
.option-card-2 {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
}

.option-emoji {
  font-size: 72rpx;
  margin-bottom: 20rpx;
  display: block;
  text-align: center;
}
.option-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
  text-align: center;
}
.option-desc {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
  text-align: center;
}
</style>
