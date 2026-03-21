<template>
  <view class="container">
    <view class="order-status-card">
      <view class="status-icon">{{ getStatusIcon(order.状态) }}</view>
      <view class="status-info">
        <text class="status-text">{{ getStatusText(order.状态) }}</text>
        <text class="status-desc">{{ order.下单时间 || '' }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">订单信息</view>
      <view class="info-row">
        <text class="info-label">订单号</text>
        <text class="info-value">{{ order.订单号 || order.订单ID }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">下单时间</text>
        <text class="info-value">{{ order.下单时间 }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">支付方式</text>
        <text class="info-value">{{ order.支付方式 || '在线支付' }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">商品信息</view>
      <view class="food-list">
        <view class="food-item" v-for="(item, index) in order.商品列表" :key="index">
          <view class="food-left">
            <text class="food-emoji">🍔</text>
          </view>
          <view class="food-center">
            <text class="food-name">{{ item.名称 || item.商品名称 }}</text>
            <text class="food-spec">{{ item.规格 || '' }}</text>
          </view>
          <view class="food-right">
            <text class="food-price">¥{{ item.价格 }}</text>
            <text class="food-quantity">x{{ item.数量 }}</text>
          </view>
        </view>
      </view>
      <view class="price-row">
        <text class="price-label">商品总额</text>
        <text class="price-value">¥{{ order.总价 }}</text>
      </view>
      <view class="price-row" v-if="order.配送费">
        <text class="price-label">配送费</text>
        <text class="price-value">¥{{ order.配送费 }}</text>
      </view>
      <view class="price-row total-row">
        <text class="price-label-total">实付款</text>
        <text class="price-value-total">¥{{ order.总价 }}</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">配送信息</view>
      <view class="delivery-info">
        <view class="delivery-row">
          <text class="delivery-icon">👤</text>
          <view class="delivery-content">
            <text class="delivery-label">收货人</text>
            <text class="delivery-value">{{ order.收货人 }} {{ order.联系电话 }}</text>
          </view>
        </view>
        <view class="delivery-row">
          <text class="delivery-icon">📍</text>
          <view class="delivery-content">
            <text class="delivery-label">配送地址</text>
            <text class="delivery-value">{{ order.收货地址 }}</text>
          </view>
        </view>
        <view class="delivery-row" v-if="order.备注">
          <text class="delivery-icon">📝</text>
          <view class="delivery-content">
            <text class="delivery-label">备注</text>
            <text class="delivery-value">{{ order.备注 }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section" v-if="orderLog.length > 0">
      <view class="section-title">订单轨迹</view>
      <view class="timeline">
        <view class="timeline-item" v-for="(log, index) in orderLog" :key="index">
          <view class="timeline-dot" :class="{ 'timeline-dot-active': index === 0 }"></view>
          <view class="timeline-content">
            <text class="timeline-text">{{ log.内容 }}</text>
            <text class="timeline-time">{{ log.时间 }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="action-bar" v-if="showActions">
      <view class="action-btn cancel-btn" @click="handleReject" v-if="order.状态 === 0 || order.状态 === '待接单'">
        <text class="action-btn-text">拒绝订单</text>
      </view>
      <view class="action-btn primary-btn" @click="handleAccept" v-if="order.状态 === 0 || order.状态 === '待接单'">
        <text class="action-btn-text">立即接单</text>
      </view>
      <view class="action-btn primary-btn" @click="handleDeliver" v-if="order.状态 === 1 || order.状态 === '已接单'">
        <text class="action-btn-text">开始配送</text>
      </view>
      <view class="action-btn primary-btn" @click="handleConfirm" v-if="order.状态 === 2 || order.状态 === '配送中'">
        <text class="action-btn-text">确认送达</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getOrderDetail, acceptOrder, deliverOrder, confirmOrder, cancelOrder } from '@/api/order.js'

export default {
  data() {
    return {
      orderId: '',
      order: {},
      orderLog: []
    }
  },
  computed: {
    showActions() {
      const status = this.order.状态
      return status === 0 || status === '待接单' || status === 1 || status === '已接单' || status === 2 || status === '配送中'
    }
  },
  onLoad(options) {
    if (options.id) {
      this.orderId = options.id
      this.loadOrderDetail()
    }
  },
  methods: {
    async loadOrderDetail() {
      try {
        const res = await getOrderDetail(this.orderId)
        if (res) {
          this.order = res
          this.orderLog = res.订单轨迹 || [
            { 内容: '订单已提交', 时间: res.下单时间 }
          ]
        }
      } catch (e) {
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },
    getStatusIcon(status) {
      const iconMap = {
        0: '📋',
        1: '✅',
        2: '🚚',
        3: '✔️',
        4: '❌',
        '待接单': '📋',
        '已接单': '✅',
        '配送中': '🚚',
        '已完成': '✔️',
        '已取消': '❌'
      }
      return iconMap[status] || '📋'
    },
    getStatusText(status) {
      const textMap = {
        0: '待接单',
        1: '已接单',
        2: '配送中',
        3: '已完成',
        4: '已取消',
        '待接单': '待接单',
        '已接单': '已接单',
        '配送中': '配送中',
        '已完成': '已完成',
        '已取消': '已取消'
      }
      return textMap[status] || '未知'
    },
    async handleAccept() {
      try {
        await acceptOrder(this.orderId)
        uni.showToast({
          title: '接单成功',
          icon: 'success'
        })
        this.loadOrderDetail()
      } catch (e) {
        uni.showToast({
          title: '接单失败',
          icon: 'none'
        })
      }
    },
    async handleReject() {
      uni.showModal({
        title: '拒绝订单',
        content: '确定要拒绝这个订单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await cancelOrder(this.orderId)
              uni.showToast({
                title: '已拒绝',
                icon: 'success'
              })
              setTimeout(() => {
                uni.navigateBack()
              }, 1500)
            } catch (e) {
              uni.showToast({
                title: '操作失败',
                icon: 'none'
              })
            }
          }
        }
      })
    },
    async handleDeliver() {
      try {
        await deliverOrder(this.orderId)
        uni.showToast({
          title: '已开始配送',
          icon: 'success'
        })
        this.loadOrderDetail()
      } catch (e) {
        uni.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    },
    async handleConfirm() {
      uni.showModal({
        title: '确认送达',
        content: '确认订单已送达吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await confirmOrder(this.orderId)
              uni.showToast({
                title: '已送达',
                icon: 'success'
              })
              this.loadOrderDetail()
            } catch (e) {
              uni.showToast({
                title: '操作失败',
                icon: 'none'
              })
            }
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
  padding-bottom: 120rpx;
}

.order-status-card {
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  padding: 40rpx 30rpx;
  display: flex;
  align-items: center;
}

.status-icon {
  font-size: 80rpx;
  margin-right: 30rpx;
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8rpx;
}

.status-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
}

.info-value {
  font-size: 26rpx;
  color: #333;
}

.food-list {
  display: flex;
  flex-direction: column;
}

.food-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.food-item:last-child {
  border-bottom: none;
}

.food-left {
  margin-right: 20rpx;
}

.food-emoji {
  font-size: 48rpx;
}

.food-center {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.food-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.food-spec {
  font-size: 24rpx;
  color: #999;
}

.food-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.food-price {
  font-size: 28rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.food-quantity {
  font-size: 24rpx;
  color: #999;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.price-label {
  font-size: 26rpx;
  color: #666;
}

.price-value {
  font-size: 26rpx;
  color: #333;
}

.total-row {
  padding-top: 20rpx;
  margin-top: 16rpx;
  border-top: 1rpx solid #F0F0F0;
}

.price-label-total {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.price-value-total {
  font-size: 36rpx;
  font-weight: bold;
  color: #FF6B35;
}

.delivery-info {
  display: flex;
  flex-direction: column;
}

.delivery-row {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
}

.delivery-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.delivery-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.delivery-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.delivery-value {
  font-size: 26rpx;
  color: #333;
}

.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 0;
}

.timeline-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background-color: #ddd;
  margin-right: 20rpx;
  margin-top: 8rpx;
  flex-shrink: 0;
}

.timeline-dot-active {
  background-color: #FF6B35;
}

.timeline-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.timeline-text {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.timeline-time {
  font-size: 22rpx;
  color: #999;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 20rpx 30rpx;
  background-color: #fff;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
  gap: 20rpx;
}

.action-btn {
  min-width: 200rpx;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ddd;
}

.action-btn-text {
  font-size: 28rpx;
  color: #666;
}

.cancel-btn {
  border-color: #ddd;
}

.primary-btn {
  background-color: #FF6B35;
  border-color: #FF6B35;
}

.primary-btn .action-btn-text {
  color: #fff;
}
</style>
