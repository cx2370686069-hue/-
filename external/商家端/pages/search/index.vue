<template>
  <view class="container">
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索美食、商品"
          focus
          confirm-type="search"
          @confirm="doSearch"
        />
        <text class="clear-btn" v-if="keyword" @click="clearKeyword">✕</text>
      </view>
      <text class="cancel-btn" @click="goBack">取消</text>
    </view>

    <view class="history-section" v-if="!hasSearched && historyList.length > 0">
      <view class="history-header">
        <text class="history-title">搜索历史</text>
        <text class="history-clear" @click="clearHistory">清空</text>
      </view>
      <view class="history-tags">
        <text class="history-tag" v-for="(item, index) in historyList" :key="index" @click="searchByHistory(item)">{{ item }}</text>
      </view>
    </view>

    <view class="hot-section" v-if="!hasSearched">
      <text class="hot-title">热门搜索</text>
      <view class="hot-tags">
        <text class="hot-tag" v-for="(item, index) in hotList" :key="index" @click="searchByHistory(item)">{{ item }}</text>
      </view>
    </view>

    <view class="result-section" v-if="hasSearched">
      <view class="result-header">
        <text class="result-count">找到 {{ resultList.length }} 个商品</text>
      </view>
      <view class="goods-list" v-if="resultList.length > 0">
        <view class="goods-item" v-for="item in resultList" :key="item.商品ID" @click="goDetail(item.商品ID)">
          <view class="goods-img-wrap">
            <text class="goods-emoji">🍱</text>
          </view>
          <view class="goods-info">
            <text class="goods-name">{{ item.商品名称 }}</text>
            <text class="goods-desc">{{ item.分类 }} · 月售{{ item.月销 }}</text>
            <view class="goods-bottom">
              <text class="goods-price">¥{{ item.价格 }}</text>
              <view class="add-btn" @click.stop="handleAddToCart(item)">
                <text class="add-btn-text">+</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="empty-result" v-else>
        <text class="empty-icon">😔</text>
        <text class="empty-text">没有找到相关商品</text>
        <text class="empty-tip">换个关键词试试</text>
      </view>
    </view>
  </view>
</template>

<script>
import { searchFood } from '@/api/food.js'
import { addToCart } from '@/api/cart.js'
import { requireLogin } from '@/utils/auth.js'
import { HOT_SEARCH } from '@/config/index.js'

export default {
  data() {
    return {
      keyword: '',
      hasSearched: false,
      resultList: [],
      historyList: [],
      hotList: HOT_SEARCH
    }
  },
  onLoad() {
    this.loadHistory()
  },
  methods: {
    loadHistory() {
      this.historyList = uni.getStorageSync('searchHistory') || []
    },
    saveHistory(keyword) {
      let history = uni.getStorageSync('searchHistory') || []
      history = history.filter(h => h !== keyword)
      history.unshift(keyword)
      if (history.length > 10) history = history.slice(0, 10)
      uni.setStorageSync('searchHistory', history)
      this.historyList = history
    },
    clearHistory() {
      uni.removeStorageSync('searchHistory')
      this.historyList = []
    },
    async doSearch() {
      const kw = this.keyword.trim()
      if (!kw) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' })
        return
      }
      this.saveHistory(kw)
      try {
        const res = await searchFood(kw)
        this.resultList = res.商品列表 || []
        this.hasSearched = true
      } catch (e) {}
    },
    searchByHistory(kw) {
      this.keyword = kw
      this.doSearch()
    },
    clearKeyword() {
      this.keyword = ''
      this.hasSearched = false
      this.resultList = []
    },
    goBack() {
      uni.navigateBack()
    },
    async handleAddToCart(item) {
      if (!requireLogin()) return
      try {
        const res = await addToCart(item.商品ID)
        uni.showToast({ title: res.消息, icon: 'success' })
      } catch (e) {}
    },
    goDetail(id) {
      uni.navigateTo({ url: '/pages/food/detail?id=' + id })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  background-color: #fff;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 40rpx;
  padding: 14rpx 20rpx;
}
.search-icon {
  font-size: 28rpx;
  margin-right: 10rpx;
}
.search-input {
  flex: 1;
  font-size: 28rpx;
}
.clear-btn {
  font-size: 26rpx;
  color: #999;
  padding: 0 10rpx;
}
.cancel-btn {
  font-size: 28rpx;
  color: #FF6B35;
  margin-left: 16rpx;
  padding: 10rpx;
}

.history-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.history-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}
.history-clear {
  font-size: 24rpx;
  color: #999;
}
.history-tags {
  display: flex;
  flex-wrap: wrap;
}
.history-tag {
  font-size: 24rpx;
  color: #666;
  background-color: #f5f5f5;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  margin-right: 16rpx;
  margin-bottom: 12rpx;
}

.hot-section {
  background-color: #fff;
  margin: 0 20rpx 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.hot-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}
.hot-tags {
  display: flex;
  flex-wrap: wrap;
}
.hot-tag {
  font-size: 24rpx;
  color: #FF6B35;
  background-color: #FFF5EE;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  margin-right: 16rpx;
  margin-bottom: 12rpx;
}

.result-section {
  padding: 20rpx;
}
.result-header {
  margin-bottom: 16rpx;
}
.result-count {
  font-size: 24rpx;
  color: #999;
}
.goods-list {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 10rpx 24rpx;
}
.goods-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.goods-item:last-child {
  border-bottom: none;
}
.goods-img-wrap {
  width: 140rpx;
  height: 140rpx;
  background-color: #FFF5EE;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}
.goods-emoji {
  font-size: 60rpx;
}
.goods-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.goods-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}
.goods-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}
.goods-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
}
.goods-price {
  font-size: 32rpx;
  color: #FF6B35;
  font-weight: bold;
}
.add-btn {
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-btn-text {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
  line-height: 48rpx;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}
.empty-icon {
  font-size: 80rpx;
}
.empty-text {
  font-size: 30rpx;
  color: #999;
  margin-top: 20rpx;
}
.empty-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 10rpx;
}
</style>
