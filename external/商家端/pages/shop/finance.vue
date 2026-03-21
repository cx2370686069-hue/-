<template>
  <view class="container">
    <view class="stats-header">
      <view class="header-stat">
        <text class="stat-value">¥{{ stats.totalIncome }}</text>
        <text class="stat-label">总收入</text>
      </view>
      <view class="header-stat">
        <text class="stat-value">¥{{ stats.withdrawable }}</text>
        <text class="stat-label">可提现</text>
      </view>
    </view>

    <view class="withdraw-section">
      <view class="withdraw-btn" @click="handleWithdraw">
        <text class="withdraw-icon">💰</text>
        <text class="withdraw-text">立即提现</text>
      </view>
    </view>

    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 0 }"
        @click="currentTab = 0"
      >
        收入明细
      </view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 1 }"
        @click="currentTab = 1"
      >
        提现记录
      </view>
    </view>

    <view class="list-section" v-if="currentTab === 0">
      <view class="income-list" v-if="incomeList.length > 0">
        <view class="income-item" v-for="item in incomeList" :key="item.id">
          <view class="income-left">
            <view class="income-icon">💵</view>
            <view class="income-info">
              <text class="income-title">{{ item.title }}</text>
              <text class="income-time">{{ item.time }}</text>
            </view>
          </view>
          <view class="income-right">
            <text class="income-amount" :class="item.type === 'income' ? 'amount-positive' : 'amount-negative'">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount }}
            </text>
            <text class="income-status">{{ item.status }}</text>
          </view>
        </view>
      </view>
      <view class="empty" v-else>
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无收入记录</text>
      </view>
    </view>

    <view class="list-section" v-if="currentTab === 1">
      <view class="withdraw-list" v-if="withdrawList.length > 0">
        <view class="withdraw-item" v-for="item in withdrawList" :key="item.id">
          <view class="withdraw-left">
            <view class="withdraw-icon">🏦</view>
            <view class="withdraw-info">
              <text class="withdraw-title">{{ item.bank }}</text>
              <text class="withdraw-account">尾号{{ item.account }}</text>
            </view>
          </view>
          <view class="withdraw-right">
            <text class="withdraw-amount">¥{{ item.amount }}</text>
            <text class="withdraw-status" :class="'status-' + item.status">
              {{ getStatusText(item.status) }}
            </text>
          </view>
        </view>
      </view>
      <view class="empty" v-else>
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无提现记录</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      currentTab: 0,
      stats: {
        totalIncome: 0,
        withdrawable: 0
      },
      incomeList: [],
      withdrawList: []
    }
  },
  onLoad() {
    this.loadData()
  },
  methods: {
    loadData() {
      this.stats = {
        totalIncome: 0,
        withdrawable: 0
      }
      this.incomeList = []
      this.withdrawList = []
    },
    handleWithdraw() {
      uni.showModal({
        title: '提现',
        content: '提现功能开发中',
        showCancel: false
      })
    },
    getStatusText(status) {
      const map = {
        0: '处理中',
        1: '已到账',
        2: '已拒绝'
      }
      return map[status] || '未知'
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #F5F5F5;
  padding: 20rpx;
}

.stats-header {
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  padding: 40rpx;
  border-radius: 16rpx;
  display: flex;
  justify-content: space-around;
  margin-bottom: 20rpx;
}

.header-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
}

.stat-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.withdraw-section {
  margin-bottom: 20rpx;
}

.withdraw-btn {
  width: 100%;
  height: 100rpx;
  background-color: #FF6B35;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.withdraw-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
}

.withdraw-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.tabs {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666;
  border-bottom: 2rpx solid transparent;
}

.tab-item.tab-active {
  color: #FF6B35;
  border-bottom-color: #FF6B35;
}

.list-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.income-list,
.withdraw-list {
  display: flex;
  flex-direction: column;
}

.income-item,
.withdraw-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.income-item:last-child,
.withdraw-item:last-child {
  border-bottom: none;
}

.income-left,
.withdraw-left {
  display: flex;
  align-items: center;
}

.income-icon,
.withdraw-icon {
  width: 80rpx;
  height: 80rpx;
  background-color: #F5F5F5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
}

.income-info,
.withdraw-info {
  display: flex;
  flex-direction: column;
}

.income-title,
.withdraw-title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.income-time,
.withdraw-account {
  font-size: 24rpx;
  color: #999;
}

.income-right,
.withdraw-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.income-amount,
.withdraw-amount {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.amount-positive {
  color: #52C41A;
}

.amount-negative {
  color: #FF4D4F;
}

.income-status,
.withdraw-status {
  font-size: 24rpx;
  color: #999;
}

.withdraw-status.status-0 {
  color: #1890FF;
}

.withdraw-status.status-1 {
  color: #52C41A;
}

.withdraw-status.status-2 {
  color: #FF4D4F;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}
</style>
