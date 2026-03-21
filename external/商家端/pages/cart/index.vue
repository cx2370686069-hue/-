<template>
  <view class="container">
    <view v-if="cartList.length > 0">
      <view class="cart-item" v-for="(item, index) in cartList" :key="index">
        <view class="item-left">
          <text class="item-emoji">🍱</text>
        </view>
        <view class="item-center">
          <text class="item-name">{{ item.商品名称 }}</text>
          <text class="item-price">¥{{ item.价格 }}</text>
        </view>
        <view class="item-right">
          <view class="qty-btn" @click="changeQty(item, -1)">
            <text class="qty-btn-text">-</text>
          </view>
          <text class="qty-num">{{ item.数量 }}</text>
          <view class="qty-btn" @click="changeQty(item, 1)">
            <text class="qty-btn-text">+</text>
          </view>
        </view>
      </view>

      <view class="checkout-bar">
        <view class="checkout-left">
          <text class="total-label">合计：</text>
          <text class="total-price">¥{{ totalPrice }}</text>
        </view>
        <view class="checkout-btn" @click="goCheckout">
          <text class="checkout-btn-text">去结算({{ totalCount }})</text>
        </view>
      </view>

      <view style="height: 130rpx;"></view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">🛒</text>
      <text class="empty-text">购物车空空如也</text>
      <text class="empty-tip">快去首页挑选美食吧~</text>
    </view>
  </view>
</template>

<script>
import { getCartList, addToCart, removeFromCart } from '@/api/cart.js'
import { isLoggedIn } from '@/utils/auth.js'

export default {
  data() {
    return {
      cartList: [],
      totalPrice: 0,
      totalCount: 0
    }
  },
  onShow() {
    this.loadCart()
  },
  async onPullDownRefresh() {
    await this.loadCart()
    uni.stopPullDownRefresh()
  },
  methods: {
    async loadCart() {
      if (!isLoggedIn()) {
        this.cartList = []
        uni.removeTabBarBadge({ index: 1 })
        return
      }
      try {
        const res = await getCartList()
        this.cartList = res.购物车 || []
        this.totalPrice = res.总价 || 0
        this.totalCount = res.总数量 || 0
        if (this.totalCount > 0) {
          uni.setTabBarBadge({ index: 1, text: String(this.totalCount) })
        } else {
          uni.removeTabBarBadge({ index: 1 })
        }
      } catch (e) {}
    },
    async changeQty(item, delta) {
      if (item.数量 + delta <= 0) {
        try {
          await removeFromCart(item.商品ID)
          this.loadCart()
        } catch (e) {}
        return
      }
      if (delta > 0) {
        try {
          await addToCart(item.商品ID, 1)
          this.loadCart()
        } catch (e) {}
      } else {
        try {
          await removeFromCart(item.商品ID)
          this.loadCart()
        } catch (e) {}
      }
    },
    goCheckout() {
      if (this.cartList.length === 0) return
      uni.navigateTo({ url: '/pages/cart/checkout' })
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
.cart-item {
  display: flex;
  align-items: center;
  background-color: #fff;
  margin: 16rpx 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.item-left {
  width: 100rpx;
  height: 100rpx;
  background-color: #FFF5EE;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}
.item-emoji {
  font-size: 50rpx;
}
.item-center {
  flex: 1;
}
.item-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
}
.item-price {
  font-size: 28rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-top: 10rpx;
  display: block;
}
.item-right {
  display: flex;
  align-items: center;
}
.qty-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qty-btn-text {
  font-size: 28rpx;
  color: #666;
  line-height: 48rpx;
}
.qty-num {
  font-size: 28rpx;
  margin: 0 20rpx;
  color: #333;
}

.checkout-bar {
  position: fixed;
  bottom: 100rpx;
  left: 0;
  right: 0;
  height: 110rpx;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
  z-index: 100;
}
.checkout-left {
  display: flex;
  align-items: baseline;
}
.total-label {
  font-size: 26rpx;
  color: #666;
}
.total-price {
  font-size: 38rpx;
  color: #FF6B35;
  font-weight: bold;
}
.checkout-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 18rpx 48rpx;
  border-radius: 40rpx;
}
.checkout-btn-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 240rpx;
}
.empty-icon {
  font-size: 100rpx;
}
.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-top: 20rpx;
}
.empty-tip {
  font-size: 26rpx;
  color: #999;
  margin-top: 10rpx;
}
</style>
