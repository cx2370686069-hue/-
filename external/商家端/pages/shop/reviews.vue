<template>
  <view class="container">
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 0 }"
        @click="currentTab = 0"
      >
        全部评价
      </view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 1 }"
        @click="currentTab = 1"
      >
        好评
      </view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 2 }"
        @click="currentTab = 2"
      >
        中评
      </view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': currentTab === 3 }"
        @click="currentTab = 3"
      >
        差评
      </view>
    </view>

    <view class="stats-section" v-if="currentTab === 0">
      <view class="rating-overview">
        <view class="rating-score">
          <text class="score-value">{{ stats.avgRating }}</text>
          <text class="score-label">店铺评分</text>
        </view>
        <view class="rating-bars">
          <view class="rating-bar-item">
            <text class="bar-label">5 星</text>
            <view class="bar-bg">
              <view class="bar-fill" :style="{ width: stats.fiveStar + '%' }"></view>
            </view>
            <text class="bar-value">{{ stats.fiveStarCount }}</text>
          </view>
          <view class="rating-bar-item">
            <text class="bar-label">4 星</text>
            <view class="bar-bg">
              <view class="bar-fill" :style="{ width: stats.fourStar + '%' }"></view>
            </view>
            <text class="bar-value">{{ stats.fourStarCount }}</text>
          </view>
          <view class="rating-bar-item">
            <text class="bar-label">3 星</text>
            <view class="bar-bg">
              <view class="bar-fill" :style="{ width: stats.threeStar + '%' }"></view>
            </view>
            <text class="bar-value">{{ stats.threeStarCount }}</text>
          </view>
          <view class="rating-bar-item">
            <text class="bar-label">1-2 星</text>
            <view class="bar-bg">
              <view class="bar-fill" :style="{ width: stats.lowStar + '%' }"></view>
            </view>
            <text class="bar-value">{{ stats.lowStarCount }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="review-list" v-if="reviewList.length > 0">
      <view class="review-item" v-for="item in reviewList" :key="item.id">
        <view class="review-header">
          <view class="user-info">
            <text class="user-avatar">👤</text>
            <text class="user-name">{{ item.userName }}</text>
          </view>
          <view class="review-rating">
            <text class="rating-star" v-for="i in 5" :key="i">
              {{ i <= item.rating ? '⭐' : '☆' }}
            </text>
          </view>
        </view>
        <view class="review-content">
          <text class="review-text">{{ item.content }}</text>
        </view>
        <view class="review-order">
          <text class="order-info">订单号：{{ item.orderId }}</text>
          <text class="review-time">{{ item.time }}</text>
        </view>
        <view class="review-reply" v-if="item.reply">
          <view class="reply-header">
            <text class="reply-icon">🏪</text>
            <text class="reply-label">商家回复</text>
          </view>
          <text class="reply-text">{{ item.reply }}</text>
        </view>
        <view class="review-actions" v-if="!item.reply">
          <view class="reply-btn" @click="handleReply(item)">
            <text class="reply-btn-text">回复</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📭</text>
      <text class="empty-text">暂无评价</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      currentTab: 0,
      stats: {
        avgRating: 0,
        fiveStar: 0,
        fiveStarCount: 0,
        fourStar: 0,
        fourStarCount: 0,
        threeStar: 0,
        threeStarCount: 0,
        lowStar: 0,
        lowStarCount: 0
      },
      reviewList: []
    }
  },
  onLoad() {
    this.loadReviews()
  },
  methods: {
    loadReviews() {
      this.reviewList = []
      this.stats = {
        avgRating: 0,
        fiveStar: 0,
        fiveStarCount: 0,
        fourStar: 0,
        fourStarCount: 0,
        threeStar: 0,
        threeStarCount: 0,
        lowStar: 0,
        lowStarCount: 0
      }
    },
    handleReply(item) {
      uni.showModal({
        title: '回复评价',
        editable: true,
        placeholderText: '请输入回复内容',
        success: (res) => {
          if (res.confirm && res.content) {
            uni.showToast({
              title: '回复成功',
              icon: 'success'
            })
          }
        }
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

.tabs {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #666;
  border-bottom: 2rpx solid transparent;
}

.tab-item.tab-active {
  color: #FF6B35;
  border-bottom-color: #FF6B35;
}

.stats-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.rating-overview {
  display: flex;
  align-items: center;
}

.rating-score {
  width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 40rpx;
  border-right: 1rpx solid #F0F0F0;
}

.score-value {
  font-size: 64rpx;
  font-weight: bold;
  color: #FF6B35;
}

.score-label {
  font-size: 24rpx;
  color: #999;
}

.rating-bars {
  flex: 1;
  padding-left: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.rating-bar-item {
  display: flex;
  align-items: center;
}

.bar-label {
  width: 80rpx;
  font-size: 22rpx;
  color: #999;
}

.bar-bg {
  flex: 1;
  height: 16rpx;
  background-color: #F0F0F0;
  border-radius: 8rpx;
  margin: 0 16rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF6B35 0%, #FF8F65 100%);
  border-radius: 8rpx;
}

.bar-value {
  width: 60rpx;
  font-size: 22rpx;
  color: #666;
  text-align: right;
}

.review-list {
  display: flex;
  flex-direction: column;
}

.review-item {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.user-name {
  font-size: 28rpx;
  color: #333;
}

.review-rating {
  display: flex;
}

.rating-star {
  font-size: 28rpx;
  margin-left: 4rpx;
}

.review-content {
  margin-bottom: 16rpx;
}

.review-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

.review-order {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-top: 1rpx solid #F5F5F5;
  margin-top: 16rpx;
}

.order-info {
  font-size: 24rpx;
  color: #999;
}

.review-time {
  font-size: 24rpx;
  color: #999;
}

.review-reply {
  background-color: #F5F5F5;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-top: 16rpx;
}

.reply-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.reply-icon {
  font-size: 32rpx;
  margin-right: 8rpx;
}

.reply-label {
  font-size: 24rpx;
  color: #666;
}

.reply-text {
  font-size: 26rpx;
  color: #333;
  line-height: 1.6;
}

.review-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}

.reply-btn {
  padding: 12rpx 32rpx;
  background-color: #FF6B35;
  border-radius: 30rpx;
}

.reply-btn-text {
  font-size: 26rpx;
  color: #fff;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
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
