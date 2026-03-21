<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
      <text class="nav-title">五金商品</text>
    </view>
    <view class="list-wrap">
      <view class="goods-list" v-if="list.length > 0">
        <view class="goods-item" v-for="item in list" :key="item.商品ID" @click="goDetail(item.商品ID)">
          <view class="goods-img-wrap"><text class="goods-emoji">🛠️</text></view>
          <view class="goods-info">
            <text class="goods-name">{{ item.商品名称 }}</text>
            <text class="goods-desc">{{ item.描述 }}</text>
            <view class="goods-bottom">
              <text class="goods-price">¥{{ item.价格 }}</text>
              <view class="add-btn" @click.stop="handleAdd(item)"><text class="add-btn-text">+</text></view>
            </view>
          </view>
        </view>
      </view>
      <view class="empty" v-else>
        <text class="empty-icon">🛠️</text>
        <text class="empty-text">暂无五金商品</text>
        <text class="empty-tip">商家上架后将在此展示</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getFoodList } from '@/api/food.js'
import { addToCart } from '@/api/cart.js'
import { requireLogin } from '@/utils/auth.js'

const CATEGORY = '五金工具'

export default {
  data() {
    return {
      list: []
    }
  },
  onLoad() {
    this.loadList()
  },
  onPullDownRefresh() {
    this.loadList().then(() => uni.stopPullDownRefresh())
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    async loadList() {
      try {
        const res = await getFoodList(CATEGORY)
        this.list = res.商品列表 || []
      } catch (e) {
        this.list = []
      }
    },
    goDetail(id) {
      uni.navigateTo({ url: '/pages/food/detail?id=' + id })
    },
    handleAdd(item) {
      requireLogin(() => {
        addToCart(item.商品ID, 1).then(() => {
          uni.showToast({ title: '已加购物车', icon: 'success' })
        }).catch(() => {
          uni.showToast({ title: '添加失败', icon: 'none' })
        })
      })
    }
  }
}
</script>

<style scoped>
.container { background: #f5f5f5; min-height: 100vh; padding-bottom: 40rpx; }
.nav-bar {
  padding-top: calc(44rpx + env(safe-area-inset-top));
  padding-bottom: 24rpx;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  display: flex;
  align-items: center;
}
.nav-left { display: flex; align-items: center; }
.nav-back { font-size: 48rpx; color: #fff; font-weight: 300; margin-right: 10rpx; }
.nav-back-text { font-size: 36rpx; font-weight: bold; color: #fff; }
.nav-title { font-size: 36rpx; font-weight: bold; color: #fff; margin-left: 20rpx; }

.list-wrap { padding: 24rpx; }
.goods-list { display: flex; flex-direction: column; gap: 20rpx; }
.goods-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.goods-img-wrap {
  width: 160rpx;
  height: 160rpx;
  background: #FFF7E6;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}
.goods-emoji { font-size: 72rpx; }
.goods-info { flex: 1; min-width: 0; }
.goods-name { font-size: 30rpx; font-weight: bold; color: #333; display: block; margin-bottom: 8rpx; }
.goods-desc { font-size: 26rpx; color: #666; display: block; margin-bottom: 12rpx; }
.goods-bottom { display: flex; align-items: center; justify-content: space-between; }
.goods-price { font-size: 34rpx; font-weight: bold; color: #FF6B35; }
.add-btn { width: 56rpx; height: 56rpx; background: #FF6B35; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.add-btn-text { font-size: 36rpx; color: #fff; font-weight: bold; }

.empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 40rpx; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 30rpx; color: #999; margin-bottom: 12rpx; }
.empty-tip { font-size: 24rpx; color: #ccc; }
</style>
