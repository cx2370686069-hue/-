<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
    </view>
    <view class="option-grid">
      <view class="option-card" @click="goSellPhone">
        <text class="option-title">我要卖手机</text>
      </view>
      <view class="option-card" @click="goBuyPhone">
        <text class="option-title">我要买二手机</text>
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
    goSellPhone() {
      uni.navigateTo({ url: '/pages/sell-phone/index' })
    },
    goBuyPhone() {
      uni.navigateTo({ url: '/pages/buy-phone/index' })
    },
    onOptionClick(name) {
      uni.showToast({ title: name + ' 敬请期待', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding: 40rpx;
  padding-top: 0;
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

.option-grid {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  padding-top: 280rpx;
}

.option-card {
  width: 100%;
  min-height: 320rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1);
}
.option-card:nth-child(1) {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
}
.option-card:nth-child(2) {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

.option-title {
  font-size: 56rpx;
  font-weight: bold;
  color: #fff;
}
</style>
