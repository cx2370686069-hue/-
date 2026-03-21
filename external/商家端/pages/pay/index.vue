<template>
  <view class="container">
    <view class="amount-section">
      <text class="amount-label">支付金额</text>
      <text class="amount-value">¥{{ totalPrice }}</text>
      <text class="order-no">订单号：{{ orderId }}</text>
    </view>

    <view class="pay-section">
      <text class="section-title">选择支付方式</text>
      <view
        class="pay-item"
        v-for="item in payMethods"
        :key="item.id"
        @click="selectMethod(item.id)"
      >
        <view class="pay-item-left">
          <text class="pay-icon">{{ item.icon }}</text>
          <view class="pay-info">
            <text class="pay-name">{{ item.name }}</text>
            <text class="pay-desc">{{ item.desc }}</text>
          </view>
        </view>
        <view class="radio" :class="{checked: selectedMethod === item.id}">
          <text class="radio-dot" v-if="selectedMethod === item.id">✓</text>
        </view>
      </view>
    </view>

    <view class="pay-bar">
      <view class="cancel-btn" @click="handleCancel">
        <text class="cancel-btn-text">取消订单</text>
      </view>
      <view class="pay-btn" @click="confirmPay">
        <text class="pay-btn-text">确认支付 ¥{{ totalPrice }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { payOrder, cancelOrder } from '@/api/order.js'
import { PAY_METHODS, PAY_METHOD_NAMES } from '@/config/index.js'

export default {
  data() {
    return {
      orderId: '',
      totalPrice: '0.00',
      selectedMethod: 'wechat',
      payMethods: PAY_METHODS
    }
  },
  onLoad(options) {
    this.orderId = options.orderId || ''
    this.totalPrice = options.totalPrice || '0.00'
  },
  methods: {
    selectMethod(id) {
      this.selectedMethod = id
    },
    async confirmPay() {
      const methodName = PAY_METHOD_NAMES[this.selectedMethod]
      uni.showLoading({ title: '支付处理中...' })

      setTimeout(async () => {
        try {
          await payOrder(this.orderId, methodName)
          uni.hideLoading()
          uni.showToast({ title: '支付成功', icon: 'success' })
          setTimeout(() => {
            uni.switchTab({ url: '/pages/order/index' })
          }, 1500)
        } catch (e) {
          uni.hideLoading()
        }
      }, 1500)
    },
    handleCancel() {
      uni.showModal({
        title: '取消订单',
        content: '确定要取消这个订单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await cancelOrder(this.orderId)
              uni.showToast({ title: '订单已取消', icon: 'none' })
              setTimeout(() => {
                uni.switchTab({ url: '/pages/order/index' })
              }, 1000)
            } catch (e) {}
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 160rpx;
}

.amount-section {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 60rpx 30rpx 50rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.amount-label {
  font-size: 28rpx;
  color: rgba(255,255,255,0.8);
}
.amount-value {
  font-size: 72rpx;
  color: #fff;
  font-weight: bold;
  margin-top: 16rpx;
}
.order-no {
  font-size: 22rpx;
  color: rgba(255,255,255,0.6);
  margin-top: 16rpx;
}

.pay-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}
.pay-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.pay-item:last-child {
  border-bottom: none;
}
.pay-item-left {
  display: flex;
  align-items: center;
}
.pay-icon {
  font-size: 44rpx;
  margin-right: 20rpx;
}
.pay-info {
  display: flex;
  flex-direction: column;
}
.pay-name {
  font-size: 30rpx;
  color: #333;
}
.pay-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}
.radio {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio.checked {
  border-color: #FF6B35;
  background-color: #FF6B35;
}
.radio-dot {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.pay-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background-color: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
}
.cancel-btn {
  padding: 20rpx 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 44rpx;
  margin-right: 20rpx;
}
.cancel-btn-text {
  font-size: 28rpx;
  color: #666;
}
.pay-btn {
  flex: 1;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 20rpx 0;
  text-align: center;
}
.pay-btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}
</style>
