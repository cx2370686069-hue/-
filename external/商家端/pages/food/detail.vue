<template>
  <view class="container" v-if="food">
    <view class="img-section">
      <text class="food-emoji">🍱</text>
      <view class="category-tag">
        <text class="category-text">{{ food.分类 }}</text>
      </view>
    </view>

    <view class="info-section">
      <text class="food-name">{{ food.商品名称 }}</text>
      <view class="info-row">
        <text class="food-price">¥{{ food.价格 }}</text>
        <text class="food-sales">月售 {{ food.月销 }}</text>
      </view>
      <text class="food-desc" v-if="food.描述">{{ food.描述 }}</text>
      <view class="stock-row">
        <text class="stock-label">库存：{{ food.库存 }}</text>
      </view>
    </view>

    <view class="detail-section">
      <text class="section-title">商品信息</text>
      <view class="detail-item">
        <text class="detail-label">商品名称</text>
        <text class="detail-value">{{ food.商品名称 }}</text>
      </view>
      <view class="detail-item">
        <text class="detail-label">所属分类</text>
        <text class="detail-value">{{ food.分类 }}</text>
      </view>
      <view class="detail-item">
        <text class="detail-label">月销量</text>
        <text class="detail-value">{{ food.月销 }} 份</text>
      </view>
      <view class="detail-item">
        <text class="detail-label">剩余库存</text>
        <text class="detail-value">{{ food.库存 }} 份</text>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="bottom-left">
        <view class="bottom-icon-item" @click="goCart">
          <text class="bottom-icon">🛒</text>
          <text class="bottom-icon-label">购物车</text>
        </view>
      </view>
      <view class="bottom-right">
        <view class="qty-control">
          <view class="qty-btn" @click="changeQty(-1)">
            <text class="qty-btn-text">-</text>
          </view>
          <text class="qty-num">{{ quantity }}</text>
          <view class="qty-btn" @click="changeQty(1)">
            <text class="qty-btn-text">+</text>
          </view>
        </view>
        <view class="add-cart-btn" @click="handleAddToCart">
          <text class="add-cart-text">加入购物车</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getFoodDetail } from '@/api/food.js'
import { addToCart, getCartList } from '@/api/cart.js'
import { requireLogin } from '@/utils/auth.js'

export default {
  data() {
    return {
      food: null,
      quantity: 1
    }
  },
  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id)
    }
  },
  methods: {
    async loadDetail(id) {
      try {
        const res = await getFoodDetail(id)
        this.food = res.商品 || null
        if (this.food) {
          uni.setNavigationBarTitle({ title: this.food.商品名称 })
        }
      } catch (e) {}
    },
    changeQty(delta) {
      const next = this.quantity + delta
      if (next < 1) return
      if (this.food && next > this.food.库存) {
        uni.showToast({ title: '超出库存', icon: 'none' })
        return
      }
      this.quantity = next
    },
    async handleAddToCart() {
      if (!requireLogin()) return
      try {
        const res = await addToCart(this.food.商品ID, this.quantity)
        uni.showToast({ title: `已加入${this.quantity}份`, icon: 'success' })
        this.quantity = 1
      } catch (e) {}
    },
    goCart() {
      uni.switchTab({ url: '/pages/cart/index' })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 140rpx;
}

.img-section {
  width: 100%;
  height: 480rpx;
  background: linear-gradient(135deg, #FFF5EE, #FFE8D6);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.food-emoji {
  font-size: 200rpx;
}
.category-tag {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  background-color: rgba(255,107,53,0.9);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
.category-text {
  font-size: 22rpx;
  color: #fff;
}

.info-section {
  background-color: #fff;
  margin: -40rpx 20rpx 0;
  border-radius: 20rpx;
  padding: 30rpx;
  position: relative;
  z-index: 2;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
}
.food-name {
  font-size: 38rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}
.info-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 16rpx;
}
.food-price {
  font-size: 44rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-right: 24rpx;
}
.food-sales {
  font-size: 24rpx;
  color: #999;
}
.food-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  margin-bottom: 16rpx;
}
.stock-row {
  display: flex;
  align-items: center;
}
.stock-label {
  font-size: 24rpx;
  color: #999;
}

.detail-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.detail-item:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: 26rpx;
  color: #999;
}
.detail-value {
  font-size: 26rpx;
  color: #333;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background-color: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
  z-index: 100;
}
.bottom-left {
  margin-right: 24rpx;
}
.bottom-icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bottom-icon {
  font-size: 40rpx;
}
.bottom-icon-label {
  font-size: 20rpx;
  color: #666;
  margin-top: 2rpx;
}
.bottom-right {
  flex: 1;
  display: flex;
  align-items: center;
}
.qty-control {
  display: flex;
  align-items: center;
  margin-right: 20rpx;
}
.qty-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qty-btn-text {
  font-size: 30rpx;
  color: #666;
  line-height: 52rpx;
}
.qty-num {
  font-size: 30rpx;
  color: #333;
  margin: 0 20rpx;
  min-width: 40rpx;
  text-align: center;
}
.add-cart-btn {
  flex: 1;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 20rpx 0;
  text-align: center;
}
.add-cart-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}
</style>
