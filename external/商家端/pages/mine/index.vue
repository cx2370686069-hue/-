<template>
  <view class="container">
    <view class="card user-card">
      <view class="user-avatar">{{ (userName || '商').charAt(0) }}</view>
      <view class="user-info">
        <text class="user-name">{{ userName || '商家用户' }}</text>
        <text class="user-phone text-gray">{{ phone || '未绑定手机' }}</text>
      </view>
    </view>

    <view class="card menu-list">
      <view class="menu-item" @click="goShop">
        <text>🏪 店铺管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goProducts">
        <text>🍱 商品管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goFinance">
        <text>💰 财务管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goStats">
        <text>📊 数据统计</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goReview">
        <text>⭐ 顾客评价</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="card">
      <button class="logout-btn" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      userInfo: null
    }
  },
  onLoad() {
    this.userInfo = uni.getStorageSync('userInfo') || null
  },
  computed: {
    userName() {
      return this.userInfo?.name || '商家用户';
    },
    phone() {
      return this.userInfo?.phone || '未绑定手机';
    }
  },
  methods: {
    goShop() {
      uni.navigateTo({ url: '/pages/shop/index' });
    },
    goProducts() {
      uni.navigateTo({ url: '/pages/product/list' });
    },
    goFinance() {
      uni.navigateTo({ url: '/pages/finance/index' });
    },
    goStats() {
      uni.navigateTo({ url: '/pages/stats/index' });
    },
    goReview() {
      uni.navigateTo({ url: '/pages/review/list' });
    },
    logout() {
      uni.showModal({
        title: '提示',
        content: '确定退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('userInfo')
            this.userInfo = null
            uni.showToast({ title: '已退出', icon: 'none' })
            setTimeout(() => {
              uni.reLaunch({ url: '/pages/login/index' })
            }, 500)
          }
        }
      });
    }
  }
};
</script>

<style scoped>
.user-card { display: flex; align-items: center; gap: 24rpx; }
.user-avatar {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%);
  color: #fff;
  font-size: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-name { font-size: 34rpx; font-weight: 600; display: block; }
.user-phone { font-size: 26rpx; margin-top: 8rpx; }
.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 0;
  font-size: 30rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.menu-item:last-child { border-bottom: none; }
.arrow { color: #ccc; font-size: 36rpx; }
.logout-btn {
  width: 100%;
  background: transparent;
  color: #f44336;
  border: none;
  padding: 24rpx;
  font-size: 30rpx;
}
</style>
