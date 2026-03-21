<template>
  <view class="container">
    <view class="section addr-section" @click="chooseAddress">
      <view v-if="selectedAddress" class="addr-info">
        <view class="addr-top-row">
          <text class="addr-name">{{ selectedAddress.收货人 }}</text>
          <text class="addr-phone">{{ selectedAddress.联系电话 }}</text>
        </view>
        <text class="addr-detail">{{ selectedAddress.详细地址 }}</text>
      </view>
      <view v-else class="addr-empty">
        <text class="addr-empty-icon">📍</text>
        <text class="addr-empty-text">请选择收货地址</text>
      </view>
      <text class="addr-arrow">›</text>
    </view>

    <view class="section">
      <view class="input-group">
        <text class="label">备注</text>
        <input class="input" v-model="remark" placeholder="如：少放辣、不要葱（选填）" />
      </view>
    </view>

    <view class="section">
      <view class="section-title">商品清单</view>
      <view class="food-item" v-for="(item, index) in cartList" :key="index">
        <text class="food-name">{{ item.商品名称 }} x{{ item.数量 }}</text>
        <text class="food-price">¥{{ (item.价格 * item.数量).toFixed(2) }}</text>
      </view>
    </view>

    <view class="submit-bar">
      <view class="submit-left">
        <text class="total-label">合计：</text>
        <text class="total-price">¥{{ totalPrice }}</text>
      </view>
      <view class="submit-btn" @click="submitOrder">
        <text class="submit-btn-text">提交订单</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getCartList } from '@/api/cart.js'
import { createOrder } from '@/api/order.js'
import { getAddressList } from '@/api/address.js'

export default {
  data() {
    return {
      cartList: [],
      totalPrice: 0,
      selectedAddress: null,
      remark: ''
    }
  },
  onLoad() {
    this.loadCart()
    this.loadDefaultAddress()
  },
  methods: {
    async loadCart() {
      try {
        const res = await getCartList()
        this.cartList = res.购物车 || []
        this.totalPrice = res.总价 || 0
      } catch (e) {}
    },
    async loadDefaultAddress() {
      try {
        const res = await getAddressList()
        const list = res.地址列表 || []
        if (list.length > 0) {
          const defaultAddr = list.find(a => a.是否默认 === 1)
          this.selectedAddress = defaultAddr || list[0]
        }
      } catch (e) {}
    },
    chooseAddress() {
      uni.navigateTo({ url: '/pages/address/index?select=1' })
    },
    async submitOrder() {
      if (!this.selectedAddress) {
        uni.showToast({ title: '请选择收货地址', icon: 'none' })
        return
      }

      try {
        const res = await createOrder({
          address: this.selectedAddress.详细地址,
          phone: this.selectedAddress.联系电话,
          remark: this.remark
        })
        const order = res.订单 || {}
        uni.removeTabBarBadge({ index: 1 })
        uni.navigateTo({
          url: '/pages/pay/index?orderId=' + order.订单ID + '&totalPrice=' + order.总价
        })
      } catch (e) {}
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
.section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.addr-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.addr-info {
  flex: 1;
}
.addr-top-row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}
.addr-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-right: 20rpx;
}
.addr-phone {
  font-size: 28rpx;
  color: #666;
}
.addr-detail {
  font-size: 26rpx;
  color: #999;
}
.addr-empty {
  display: flex;
  align-items: center;
  flex: 1;
}
.addr-empty-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}
.addr-empty-text {
  font-size: 28rpx;
  color: #999;
}
.addr-arrow {
  font-size: 40rpx;
  color: #ccc;
  margin-left: 16rpx;
}

.input-group {
  display: flex;
  align-items: center;
}
.label {
  font-size: 26rpx;
  color: #666;
  width: 100rpx;
  flex-shrink: 0;
}
.input {
  flex: 1;
  font-size: 26rpx;
}

.food-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f9f9f9;
}
.food-item:last-child {
  border-bottom: none;
}
.food-name {
  font-size: 28rpx;
  color: #333;
}
.food-price {
  font-size: 28rpx;
  color: #FF6B35;
  font-weight: bold;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
}
.submit-left {
  display: flex;
  align-items: baseline;
}
.total-label {
  font-size: 26rpx;
  color: #666;
}
.total-price {
  font-size: 40rpx;
  color: #FF6B35;
  font-weight: bold;
}
.submit-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 18rpx 60rpx;
  border-radius: 40rpx;
}
.submit-btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}
</style>
