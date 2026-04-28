<template>
  <view class="container">
    <view v-if="pageState === 'loading'" class="card state-card">
      <text class="state-title">工作台加载中</text>
      <text class="state-desc">正在获取店铺经营数据，请稍候。</text>
    </view>

    <view v-else-if="pageState === 'no_shop'" class="card state-card">
      <text class="state-title">您还没有店铺</text>
      <text class="state-desc">当前账号还未完成开店，请先去提交开店信息。</text>
      <button class="state-btn primary" type="default" @click="goOpenShop">去开店</button>
    </view>

    <view v-else-if="pageState === 'error'" class="card state-card">
      <text class="state-title">工作台加载失败</text>
      <text class="state-desc">{{ pageMessage || '暂时无法获取首页数据，请稍后重试。' }}</text>
      <button class="state-btn primary" type="default" @click="loadData">重新加载</button>
    </view>

    <template v-else>
      <view v-if="pageState === 'empty'" class="card state-card">
        <text class="state-title">暂无经营数据</text>
        <text class="state-desc">店铺已存在，但首页暂未返回有效统计数据，请稍后刷新或联系后端排查。</text>
        <button class="state-btn" type="default" @click="loadData">刷新首页</button>
      </view>

      <!-- 今日概览 -->
      <view v-if="pageState === 'ready'" class="card overview">
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

      <view class="sound-tip-card" @click="enableNotifySound">
        <view class="sound-tip-main">
          <text class="sound-tip-title">新订单提示音</text>
          <text class="sound-tip-desc">{{ notifyEnabled ? '已开启，收到新订单会播放提示音' : '未开启，点击启用提示音' }}</text>
        </view>
        <text class="sound-tip-status" :class="{ off: !notifyEnabled }">{{ notifyEnabled ? '已开启' : '未开启' }}</text>
      </view>

      <!-- 待接单提醒 -->
      <view v-if="pageState === 'ready' && pendingCount > 0" class="pending-alert" @click="goOrders">
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
    </template>
  </view>
</template>

<script>
import { fetchMerchantMy, getDashboard } from '../../api/shop.js';
import { clearAuth, getToken, getUser, getUserId, hasValidMerchantSession } from '@/utils/auth.js';
import { initSocket, getSocket } from '@/utils/socket.js';
import { getMerchantNotifyStatus, enableMerchantNotifyByUserGesture, ensureMerchantNotifyReady } from '@/utils/merchant-notify.js'

export default {
  data() {
    return {
      todayOrders: 0,
      todayIncome: '0.00',
      todayNewOrders: 0,
      pendingCount: 0,
      notifyEnabled: false,
      notifyStatusText: '',
      pageState: 'loading',
      pageMessage: ''
    };
  },
  onLoad() {
    if (!this.ensureMerchantAccess()) return
    const token = getToken();
    const userInfo = getUser();
    const userId = getUserId(userInfo);

    if (token && userId && !getSocket()) {
      initSocket(token, userId);
    }
    this.syncNotifyStatus()
    uni.$on('merchant_notify_status_changed', this.syncNotifyStatus)
    uni.$on('merchant_new_order', this.loadData);
    this.loadData();
  },
  onUnload() {
    uni.$off('merchant_notify_status_changed', this.syncNotifyStatus)
    uni.$off('merchant_new_order', this.loadData);
  },
  onShow() {
    if (!this.ensureMerchantAccess()) return
    ensureMerchantNotifyReady()
    this.syncNotifyStatus();
    this.loadData();
  },
  methods: {
    ensureMerchantAccess() {
      if (hasValidMerchantSession()) return true
      clearAuth()
      this.pageState = 'loading'
      this.pageMessage = ''
      uni.reLaunch({ url: '/pages/login/index' })
      return false
    },
    resetDashboard() {
      this.todayOrders = 0
      this.todayIncome = '0.00'
      this.todayNewOrders = 0
      this.pendingCount = 0
    },
    normalizeMoney(value) {
      const num = Number(value)
      return Number.isFinite(num) ? num.toFixed(2) : '0.00'
    },
    hasDashboardMetrics(data) {
      if (!data || typeof data !== 'object') return false
      const metricKeys = ['todayOrders', 'todayRevenue', 'todayNewOrders', 'pendingOrders', 'orderCount', 'income', 'pendingCount']
      return metricKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key))
    },
    applyDashboardData(data) {
      this.todayOrders = Number(data.todayOrders ?? data.orderCount ?? 0)
      this.todayIncome = this.normalizeMoney(data.todayRevenue ?? data.income ?? 0)
      this.todayNewOrders = Number(data.todayNewOrders ?? data.todayOrders ?? data.orderCount ?? 0)
      this.pendingCount = Number(data.pendingOrders ?? data.pendingCount ?? 0)
    },
    async resolveHasShop() {
      try {
        const merchant = await fetchMerchantMy()
        return !!(merchant && typeof merchant === 'object')
      } catch (e) {
        return null
      }
    },
    syncNotifyStatus() {
      const status = getMerchantNotifyStatus()
      this.notifyEnabled = !!status.enabled
      this.notifyStatusText = status.lastError || ''
      console.log('[merchant-notify][status-sync]', status)
    },
    async enableNotifySound() {
      const status = await enableMerchantNotifyByUserGesture()
      this.notifyEnabled = !!status.enabled
      this.notifyStatusText = status.lastError || ''
      console.log('[merchant-notify][enable-click-result]', status)
      uni.showToast({
        title: status.enabled ? '提示音已开启' : '提示音开启失败',
        icon: 'none'
      })
    },
    async loadData() {
      if (!this.ensureMerchantAccess()) return
      this.pageState = 'loading'
      this.pageMessage = ''
      this.resetDashboard()
      const hasShop = await this.resolveHasShop()
      if (hasShop === false) {
        this.pageState = 'no_shop'
        return
      }
      if (hasShop == null) {
        this.pageState = 'error'
        this.pageMessage = '店铺信息校验失败，请稍后重试。'
        return
      }
      try {
        const res = await getDashboard()
        console.log('工作台数据:', res)
        const data = res && typeof res === 'object' && res.data !== undefined ? res.data : res
        if (this.hasDashboardMetrics(data)) {
          this.applyDashboardData(data)
          this.pageState = 'ready'
          return
        }
        this.pageState = 'empty'
      } catch (e) {
        console.error('加载工作台数据失败:', e)
        this.pageState = 'error'
        this.pageMessage = (e && (e.detail || e.message || e.msg)) || '暂时无法获取首页数据，请稍后重试。'
      }
    },
    goOpenShop() {
      uni.navigateTo({ url: '/pages/shop/shop-apply' })
    },
    goOrders() {
      uni.switchTab({ url: '/pages/order/list' });
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
.state-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
}
.state-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}
.state-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}
.state-btn {
  margin: 8rpx 0 0;
  font-size: 26rpx;
  border-radius: 12rpx;
}
.state-btn.primary {
  background: #ff6b35;
  color: #fff;
  border: none;
}
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
.sound-tip-card {
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.sound-tip-main {
  display: flex;
  flex-direction: column;
}
.sound-tip-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}
.sound-tip-desc {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #999;
}
.sound-tip-status {
  font-size: 24rpx;
  color: #07c160;
  background: #edf9f0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
}
.sound-tip-status.off {
  color: #ff6b35;
  background: #fff3e8;
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
