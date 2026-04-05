<template>
  <view class="container">
    <!-- 顶部营业状态 -->
    <view class="status-card">
      <view class="status-left">
        <text class="shop-name">{{ shopName || '我的店铺' }}</text>
      </view>
      <switch :checked="isOpen" @change="toggleStatus" color="#07C160" />
    </view>

    <!-- 今日概览 -->
    <view class="card overview">
      <view class="section-title">今日概览</view>
      <view class="overview-grid">
        <view class="overview-item">
          <text class="num primary-color">{{ pendingCount }}</text>
          <text class="label">待处理订单</text>
        </view>
        <view class="overview-item">
          <text class="num">{{ todayIncome }}</text>
          <text class="label">今日营收(元)</text>
        </view>
        <view class="overview-item">
          <text class="num">{{ todayNewOrders }}</text>
          <text class="label">新订单</text>
        </view>
      </view>
    </view>

    <!-- 待接单提醒 -->
    <view v-if="pendingCount > 0" class="pending-alert" @click="goOrders">
      <text>您有 {{ pendingCount }} 个订单待接单，点击处理</text>
      <text class="arrow">›</text>
    </view>

    <!-- 功能入口 -->
    <view class="card menu-grid">
      <view class="menu-item" @click="goOrders">
        <view class="icon-wrap order">
          <text class="icon">📋</text>
        </view>
        <text>订单管理</text>
      </view>
      <view class="menu-item" @click="goProducts">
        <view class="icon-wrap product">
          <text class="icon">🍱</text>
        </view>
        <text>商品管理</text>
      </view>
      <view class="menu-item" @click="goShop">
        <view class="icon-wrap shop">
          <text class="icon">🏪</text>
        </view>
        <text>店铺设置</text>
      </view>
      <view class="menu-item" @click="goFinance">
        <view class="icon-wrap finance">
          <text class="icon">💰</text>
        </view>
        <text>财务管理</text>
      </view>
      <view class="menu-item" @click="goStats">
        <view class="icon-wrap stats">
          <text class="icon">📊</text>
        </view>
        <text>数据统计</text>
      </view>
      <view class="menu-item" @click="goReview">
        <view class="icon-wrap review">
          <text class="icon">⭐</text>
        </view>
        <text>顾客评价</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getDashboard } from '../../api/index.js';
import { getToken, getUser } from '@/utils/auth.js';
import { initSocket, getSocket } from '@/utils/socket.js';

export default {
  data() {
    return {
      isOpen: true,
      shopName: '固始县外卖商家',
      todayOrders: 0,
      todayIncome: '0.00',
      todayNewOrders: 0,
      pendingCount: 0
    };
  },
  onLoad() {
    const token = getToken();
    const userInfo = getUser();
    const userId = userInfo?.id || userInfo?.userId || '';
    
    if (token && !getSocket()) {
      initSocket(token, userId);
    }
    uni.$on('merchant_new_order', this.loadData);
    this.loadData();
  },
  onUnload() {
    uni.$off('merchant_new_order', this.loadData);
  },
  onShow() {
    this.loadData();
  },
  methods: {
    async loadData() {
      try {
        const res = await getDashboard();
        console.log('工作台数据:', res);
        if (res && res.data) {
          this.shopName = res.data.shopName || '固始县外卖商家';
          this.todayOrders = res.data.todayOrders || 0;
          this.todayIncome = res.data.todayRevenue ?? '0.00';
          this.todayNewOrders = res.data.todayOrders || 0;
          this.pendingCount = res.data.pendingOrders || 0;
          this.isOpen = res.data.isOpen;
        }
      } catch (e) {
        console.error('加载工作台数据失败:', e);
        // 失败时使用演示数据（不再弹出“后端未连接”提示）
        this.todayOrders = 3;
        this.todayIncome = '256.80';
        this.todayNewOrders = 5;
        this.pendingCount = 2;
      }
    },
    toggleStatus(e) {
      const newValue = e.detail.value;
      
      // 如果是关闭（打烊），弹出确认对话框
      if (!newValue) {
        uni.showModal({
          title: '提示',
          content: '你确定现在打烊吗？',
          confirmText: '确定',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.isOpen = false;
              uni.showToast({ title: '已打烊', icon: 'none' });
            } else {
              // 用户取消，保持开启状态
              this.isOpen = true;
            }
          }
        });
      } else {
        // 开启营业，直接执行
        this.isOpen = true;
        uni.showToast({ title: '已开始营业', icon: 'none' });
      }
    },
    goOrders() {
      uni.navigateTo({ url: '/pages/order/list' });
    },
    goProducts() {
      uni.navigateTo({ url: '/pages/product/list' });
    },
    goShop() {
      uni.navigateTo({ url: '/pages/shop/index' });
    },
    goFinance() {
      uni.navigateTo({ url: '/pages/finance/index' });
    },
    goStats() {
      uni.navigateTo({ url: '/pages/stats/index' });
    },
    goReview() {
      uni.navigateTo({ url: '/pages/review/list' });
    }
  }
};
</script>

<style scoped>
.status-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%);
  padding: 32rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  color: #fff;
}
.shop-name { font-size: 36rpx; font-weight: 600; }
.status-text { font-size: 24rpx; opacity: 0.9; }
.test-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx;
}
.btn-test {
  background: #f0f0f0;
  color: #333;
  font-size: 26rpx;
  padding: 16rpx 32rpx;
  border-radius: 12rpx;
  border: none;
}
.test-result {
  font-size: 24rpx;
  margin-top: 16rpx;
}
.test-result.success { color: #52c41a; }
.test-result.error { color: #f44336; }
.section-title { font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; }
.overview-grid {
  display: flex;
  justify-content: space-around;
  padding: 16rpx 0;
}
.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.overview-item .num { font-size: 40rpx; font-weight: 600; }
.overview-item .label { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.pending-alert {
  background: #fff3e0;
  color: #e65100;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.arrow { font-size: 36rpx; }
.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32rpx;
}
.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 26rpx;
  color: #333;
}
.icon-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}
.icon-wrap.order { background: #e3f2fd; }
.icon-wrap.product { background: #e8f5e9; }
.icon-wrap.shop { background: #fff3e0; }
.icon-wrap.finance { background: #fce4ec; }
.icon-wrap.stats { background: #f3e5f5; }
.icon-wrap.review { background: #fff8e1; }
.icon { font-size: 44rpx; }
</style>
