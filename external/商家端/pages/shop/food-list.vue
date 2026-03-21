<template>
  <view class="container">
    <view class="header">
      <view class="search-bar" @click="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索商品</text>
      </view>
      <view class="add-btn" @click="goAddFood">
        <text class="add-icon">➕</text>
      </view>
    </view>

    <view class="category-scroll">
      <scroll-view scroll-x class="category-list">
        <view 
          class="category-item" 
          :class="{ 'category-active': currentCategory === 'all' }"
          @click="switchCategory('all')"
        >
          <text class="category-text">全部</text>
        </view>
        <view 
          class="category-item" 
          :class="{ 'category-active': currentCategory === item }"
          v-for="item in categories" 
          :key="item"
          @click="switchCategory(item)"
        >
          <text class="category-text">{{ item }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="food-list" v-if="foodList.length > 0">
      <view class="food-card" v-for="item in foodList" :key="item.商品 ID">
        <view class="food-image">
          <text class="food-emoji">🍔</text>
        </view>
        <view class="food-info">
          <view class="food-header">
            <text class="food-name">{{ item.商品名称 }}</text>
            <view class="food-status" :class="{ 'food-off': item.状态 === 0 }">
              <text class="status-text">{{ item.状态 === 0 ? '已售罄' : '在售' }}</text>
            </view>
          </view>
          <text class="food-desc">{{ item.描述 || '暂无描述' }}</text>
          <view class="food-footer">
            <view class="food-price-wrap">
              <text class="price-symbol">¥</text>
              <text class="food-price">{{ item.价格 }}</text>
            </view>
            <view class="food-sales">
              <text class="sales-text">月售{{ item.月销 || 0 }}</text>
            </view>
          </view>
          <view class="food-meta">
            <text class="meta-text">库存：{{ item.库存 }}</text>
            <text class="meta-text">分类：{{ item.分类 }}</text>
          </view>
        </view>
        <view class="food-actions">
          <view class="action-btn edit-btn" @click="goEditFood(item)">
            <text class="action-btn-text">编辑</text>
          </view>
          <view class="action-btn delete-btn" @click="handleDelete(item)">
            <text class="action-btn-text">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📦</text>
      <text class="empty-text">暂无商品</text>
      <view class="empty-btn" @click="goAddFood">
        <text class="empty-btn-text">添加第一个商品</text>
      </view>
    </view>

    <view class="add-food-btn" @click="goAddFood">
      <text class="add-food-icon">➕</text>
      <text class="add-food-text">添加商品</text>
    </view>
  </view>
</template>

<script>
import { getMyFoods, deleteFood } from '@/api/food.js'

export default {
  data() {
    return {
      foodList: [],
      currentCategory: 'all',
      categories: []
    }
  },
  onLoad() {
    this.loadFoods()
  },
  onShow() {
    this.loadFoods()
  },
  methods: {
    async loadFoods() {
      try {
        const res = await getMyFoods()
        if (res && res.商品列表) {
          this.foodList = res.商品列表
          const cats = [...new Set(this.foodList.map(item => item.分类).filter(Boolean))]
          this.categories = cats
        }
      } catch (e) {
        console.log('加载商品失败', e)
      }
    },
    switchCategory(category) {
      this.currentCategory = category
      if (category === 'all') {
        this.loadFoods()
      } else {
        this.foodList = this.foodList.filter(item => item.分类 === category)
      }
    },
    goAddFood() {
      uni.navigateTo({
        url: '/pages/shop/food-edit'
      })
    },
    goEditFood(item) {
      uni.navigateTo({
        url: `/pages/shop/food-edit?id=${item.商品 ID}`
      })
    },
    handleDelete(item) {
      uni.showModal({
        title: '删除商品',
        content: `确定要删除"${item.商品名称}"吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteFood(item.商品 ID)
              uni.showToast({
                title: '删除成功',
                icon: 'success'
              })
              this.loadFoods()
            } catch (e) {
              uni.showToast({
                title: '删除失败',
                icon: 'none'
              })
            }
          }
        }
      })
    },
    goSearch() {
      uni.showToast({
        title: '搜索功能开发中',
        icon: 'none'
      })
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #F5F5F5;
  padding-bottom: 140rpx;
}

.header {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background-color: #fff;
}

.search-bar {
  flex: 1;
  height: 70rpx;
  background-color: #F5F5F5;
  border-radius: 35rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  margin-right: 16rpx;
}

.search-placeholder {
  font-size: 26rpx;
  color: #999;
}

.add-btn {
  width: 70rpx;
  height: 70rpx;
  background-color: #FF6B35;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 20rpx;
}

.add-icon {
  font-size: 40rpx;
  color: #fff;
}

.category-scroll {
  background-color: #fff;
  padding: 20rpx 0;
  margin-bottom: 20rpx;
}

.category-list {
  white-space: nowrap;
}

.category-list::-webkit-scrollbar {
  display: none;
}

.category-item {
  display: inline-block;
  padding: 12rpx 32rpx;
  margin: 0 10rpx;
  background-color: #F5F5F5;
  border-radius: 30rpx;
}

.category-item.category-active {
  background-color: #FF6B35;
}

.category-text {
  font-size: 26rpx;
  color: #666;
}

.category-item.category-active .category-text {
  color: #fff;
}

.food-list {
  padding: 0 20rpx;
}

.food-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: flex-start;
}

.food-image {
  width: 160rpx;
  height: 160rpx;
  background-color: #F5F5F5;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.food-emoji {
  font-size: 80rpx;
}

.food-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.food-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.food-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
}

.food-status {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background-color: #F6FFED;
  margin-left: 12rpx;
}

.food-status.food-off {
  background-color: #FFF0F6;
}

.status-text {
  font-size: 22rpx;
  color: #52C41A;
}

.food-status.food-off .status-text {
  color: #FF4D4F;
}

.food-desc {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 16rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.food-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.food-price-wrap {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 24rpx;
  color: #FF6B35;
  font-weight: bold;
}

.food-price {
  font-size: 36rpx;
  color: #FF6B35;
  font-weight: bold;
}

.food-sales {
  display: flex;
  align-items: center;
}

.sales-text {
  font-size: 22rpx;
  color: #999;
}

.food-meta {
  display: flex;
  gap: 20rpx;
}

.meta-text {
  font-size: 22rpx;
  color: #999;
}

.food-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-left: 20rpx;
}

.action-btn {
  min-width: 100rpx;
  height: 56rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ddd;
}

.action-btn-text {
  font-size: 24rpx;
  color: #666;
}

.edit-btn {
  border-color: #1890FF;
}

.edit-btn .action-btn-text {
  color: #1890FF;
}

.delete-btn {
  border-color: #FF4D4F;
}

.delete-btn .action-btn-text {
  color: #FF4D4F;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.empty-btn {
  width: 300rpx;
  height: 80rpx;
  background-color: #FF6B35;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-btn-text {
  font-size: 28rpx;
  color: #fff;
}

.add-food-btn {
  position: fixed;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 400rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.4);
}

.add-food-icon {
  font-size: 40rpx;
  color: #fff;
  margin-right: 16rpx;
}

.add-food-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}
</style>
