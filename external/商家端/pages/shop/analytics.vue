<template>
  <view class="container">
    <view class="stats-header">
      <view class="date-range" @click="selectDate">
        <text class="date-text">{{ currentDate }}</text>
        <text class="date-icon">📅</text>
      </view>
    </view>

    <view class="stats-cards">
      <view class="stat-card">
        <text class="stat-value">¥{{ stats.todayIncome }}</text>
        <text class="stat-label">今日营收</text>
        <text class="stat-trend" :class="stats.incomeTrend > 0 ? 'trend-up' : 'trend-down'">
          {{ stats.incomeTrend > 0 ? '+' : '' }}{{ stats.incomeTrend }}%
        </text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ stats.todayOrders }}</text>
        <text class="stat-label">今日订单</text>
        <text class="stat-trend" :class="stats.orderTrend > 0 ? 'trend-up' : 'trend-down'">
          {{ stats.orderTrend > 0 ? '+' : '' }}{{ stats.orderTrend }}%
        </text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ stats.todayCustomers }}</text>
        <text class="stat-label">新客数</text>
        <text class="stat-trend" :class="stats.customerTrend > 0 ? 'trend-up' : 'trend-down'">
          {{ stats.customerTrend > 0 ? '+' : '' }}{{ stats.customerTrend }}%
        </text>
      </view>
    </view>

    <view class="chart-section">
      <view class="section-header">
        <text class="section-title">订单趋势</text>
        <picker 
          mode="selector" 
          :range="timeRanges" 
          @change="onTimeRangeChange"
        >
          <view class="time-picker">
            {{ timeRanges[currentTimeRange] }}
          </view>
        </picker>
      </view>
      <view class="chart-placeholder">
        <text class="chart-icon">📊</text>
        <text class="chart-text">订单图表区域</text>
        <text class="chart-desc">可集成 u-charts 图表库</text>
      </view>
    </view>

    <view class="rank-section">
      <view class="section-header">
        <text class="section-title">商品销量排行</text>
      </view>
      <view class="rank-list" v-if="rankList.length > 0">
        <view class="rank-item" v-for="(item, index) in rankList" :key="index">
          <view class="rank-num" :class="'rank-' + (index + 1)">{{ index + 1 }}</view>
          <view class="rank-info">
            <text class="rank-name">{{ item.商品名称 }}</text>
            <text class="rank-sales">销量：{{ item.销量 }}</text>
          </view>
          <view class="rank-revenue">¥{{ item.销售额 }}</view>
        </view>
      </view>
      <view class="empty" v-else>
        <text class="empty-text">暂无数据</text>
      </view>
    </view>

    <view class="analyze-section">
      <view class="section-header">
        <text class="section-title">经营分析</text>
      </view>
      <view class="analyze-list">
        <view class="analyze-item">
          <view class="analyze-left">
            <text class="analyze-icon">⏰</text>
            <text class="analyze-label">高峰时段</text>
          </view>
          <text class="analyze-value">{{ stats.peakHours || '11:00-13:00' }}</text>
        </view>
        <view class="analyze-item">
          <view class="analyze-left">
            <text class="analyze-icon">👥</text>
            <text class="analyze-label">客单价</text>
          </view>
          <text class="analyze-value">¥{{ stats.avgOrderPrice || 0 }}</text>
        </view>
        <view class="analyze-item">
          <view class="analyze-left">
            <text class="analyze-icon">⭐</text>
            <text class="analyze-label">店铺评分</text>
          </view>
          <text class="analyze-value">{{ stats.rating || 0 }}分</text>
        </view>
        <view class="analyze-item">
          <view class="analyze-left">
            <text class="analyze-icon">📦</text>
            <text class="analyze-label">商品总数</text>
          </view>
          <text class="analyze-value">{{ stats.totalProducts || 0 }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getShopStats } from '@/api/shop.js'

export default {
  data() {
    return {
      currentDate: new Date().toLocaleDateString(),
      currentTimeRange: 0,
      timeRanges: ['今日', '本周', '本月', '近 7 天', '近 30 天'],
      stats: {
        todayIncome: 0,
        incomeTrend: 0,
        todayOrders: 0,
        orderTrend: 0,
        todayCustomers: 0,
        customerTrend: 0,
        peakHours: '',
        avgOrderPrice: 0,
        rating: 0,
        totalProducts: 0
      },
      rankList: []
    }
  },
  onLoad() {
    this.loadStats()
  },
  methods: {
    async loadStats() {
      try {
        const res = await getShopStats()
        if (res) {
          this.stats = {
            todayIncome: res.今日营收 || 0,
            incomeTrend: res.营收趋势 || 0,
            todayOrders: res.今日订单 || 0,
            orderTrend: res.订单趋势 || 0,
            todayCustomers: res.新客数 || 0,
            customerTrend: res.新客趋势 || 0,
            peakHours: res.高峰时段 || '11:00-13:00',
            avgOrderPrice: res.客单价 || 0,
            rating: res.评分 || 0,
            totalProducts: res.商品总数 || 0
          }
          this.rankList = res.商品排行 || []
        }
      } catch (e) {
        console.log('加载数据失败', e)
      }
    },
    onTimeRangeChange(e) {
      this.currentTimeRange = e.detail.value
      this.loadStats()
    },
    selectDate() {
      uni.showModal({
        title: '提示',
        content: '日期选择功能开发中',
        showCancel: false
      })
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
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20rpx;
}

.date-range {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 16rpx 24rpx;
  border-radius: 30rpx;
}

.date-text {
  font-size: 26rpx;
  color: #333;
  margin-right: 12rpx;
}

.date-icon {
  font-size: 32rpx;
}

.stats-cards {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.stat-card {
  flex: 1;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #FF6B35;
  margin-bottom: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.stat-trend {
  font-size: 22rpx;
}

.trend-up {
  color: #52C41A;
}

.trend-down {
  color: #FF4D4F;
}

.chart-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.time-picker {
  font-size: 26rpx;
  color: #666;
  padding: 8rpx 16rpx;
  background-color: #F5F5F5;
  border-radius: 20rpx;
}

.chart-placeholder {
  height: 300rpx;
  background-color: #F5F5F5;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.chart-text {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.chart-desc {
  font-size: 24rpx;
  color: #999;
}

.rank-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.rank-list {
  display: flex;
  flex-direction: column;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  color: #666;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.rank-num.rank-1 {
  background-color: #FFD700;
  color: #fff;
}

.rank-num.rank-2 {
  background-color: #C0C0C0;
  color: #fff;
}

.rank-num.rank-3 {
  background-color: #CD7F32;
  color: #fff;
}

.rank-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.rank-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.rank-sales {
  font-size: 24rpx;
  color: #999;
}

.rank-revenue {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF6B35;
}

.analyze-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.analyze-list {
  display: flex;
  flex-direction: column;
}

.analyze-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.analyze-item:last-child {
  border-bottom: none;
}

.analyze-left {
  display: flex;
  align-items: center;
}

.analyze-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.analyze-label {
  font-size: 28rpx;
  color: #333;
}

.analyze-value {
  font-size: 28rpx;
  font-weight: bold;
  color: #FF6B35;
}

.empty {
  padding: 60rpx 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}
</style>
