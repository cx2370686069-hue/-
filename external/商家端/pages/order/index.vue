<template>
  <view class="container">
    <view class="empty" v-if="!isLogin">
      <text class="empty-icon">🔐</text>
      <text class="empty-text">请先登录查看订单</text>
      <view class="login-btn" @click="goLogin">
        <text class="login-btn-text">去登录</text>
      </view>
    </view>

    <view v-else-if="orderList.length > 0">
      <view class="order-card" v-for="order in orderList" :key="order.订单ID" @click="goDetail(order.订单ID)">
        <view class="order-header">
          <text class="order-id">订单号：{{ order.订单ID }}</text>
          <text :class="['order-status', statusClass(order.状态)]">{{ order.状态 }}</text>
        </view>

        <view class="order-foods">
          <view class="food-row" v-for="(food, i) in order.商品列表" :key="i">
            <text class="food-name">{{ food.商品名称 }} x{{ food.数量 }}</text>
            <text class="food-price">¥{{ (food.价格 * food.数量).toFixed(2) }}</text>
          </view>
        </view>

        <view class="order-footer">
          <text class="order-time">{{ order.创建时间 }}</text>
          <view class="order-footer-right">
            <text class="order-total">合计：¥{{ order.总价 }}</text>
            <view class="action-btn pay-action" v-if="order.状态 === '待付款' && userRole === 'user'" @click.stop="goPay(order)">
              <text class="action-btn-text">去支付</text>
            </view>
            <view class="action-btn cancel-action" v-if="(order.状态 === '待付款' || order.状态 === '待接单') && userRole === 'user'" @click.stop="handleCancel(order.订单ID)">
              <text class="action-btn-text">取消订单</text>
            </view>
            <view class="action-btn" v-if="order.状态 === '配送中' && userRole === 'user'" @click.stop="handleConfirm(order.订单ID)">
              <text class="action-btn-text">确认收货</text>
            </view>
            <view class="action-btn" v-if="order.状态 === '待接单' && userRole === 'shop'" @click.stop="handleAccept(order.订单ID)">
              <text class="action-btn-text">接单</text>
            </view>
            <view class="action-btn" v-if="order.状态 === '备餐中' && userRole === 'rider'" @click.stop="handleDeliver(order.订单ID)">
              <text class="action-btn-text">去配送</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无订单</text>
      <text class="empty-tip">快去首页下单吧~</text>
    </view>
  </view>
</template>

<script>
import { getOrderList, acceptOrder, deliverOrder, confirmOrder, cancelOrder } from '@/api/order.js'
import { useUserStore } from '@/store/user.js'
import { ORDER_STATUS_CLASS } from '@/config/index.js'
import { initSocket, onNewOrder, offNewOrder, getSocket } from '@/utils/socket.js'
import { getToken, getUser } from '@/utils/auth.js'

export default {
  data() {
    return {
      orderList: [],
      _newOrderHandler: null
    }
  },
  computed: {
    isLogin() {
      return useUserStore().isLoggedIn
    },
    userRole() {
      return useUserStore().role
    }
  },
  onLoad() {
    const token = getToken()
    const userInfo = getUser()
    const userId = userInfo?.id || userInfo?.userId || ''
    
    if (token && !getSocket()) {
      initSocket(token, userId)
    }
    this._newOrderHandler = (data) => {
      console.log('收到新订单推送：', data)
      if (this.isLogin) {
        this.loadOrders()
      }
    }
    onNewOrder(this._newOrderHandler)
  },
  onUnload() {
    if (this._newOrderHandler) {
      offNewOrder(this._newOrderHandler)
      this._newOrderHandler = null
    }
  },
  onShow() {
    if (this.isLogin) {
      this.loadOrders()
    }
  },
  async onPullDownRefresh() {
    try {
      if (this.isLogin) {
        await this.loadOrders()
      }
    } catch (e) {
      console.error(e)
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    async loadOrders() {
      try {
        const res = await getOrderList()
        this.orderList = res?.data?.订单列表 || res?.data?.data || res?.订单列表 || res?.data || []
      } catch (e) {}
    },
    statusClass(status) {
      return ORDER_STATUS_CLASS[status] || ''
    },
    goPay(order) {
      uni.navigateTo({
        url: '/pages/pay/index?orderId=' + order.订单ID + '&totalPrice=' + order.总价
      })
    },
    handleCancel(orderId) {
      uni.showModal({
        title: '取消订单',
        content: '确定要取消这个订单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await cancelOrder(orderId)
              uni.showToast({ title: '订单已取消', icon: 'success' })
              this.loadOrders()
            } catch (e) {}
          }
        }
      })
    },
    async handleConfirm(orderId) {
      try {
        await confirmOrder(orderId)
        uni.showToast({ title: '已确认收货', icon: 'success' })
        this.loadOrders()
      } catch (e) {}
    },
    async handleAccept(orderId) {
      try {
        await acceptOrder(orderId, {
          merchant_lng: 115.681123,
          merchant_lat: 32.181234
        })
        uni.showToast({ title: '已接单', icon: 'success' })
        this.loadOrders()
      } catch (e) {}
    },
    async handleDeliver(orderId) {
      try {
        await deliverOrder(orderId)
        uni.showToast({ title: '开始配送', icon: 'success' })
        this.loadOrders()
      } catch (e) {}
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/login/index' })
    },
    goDetail(orderId) {
      uni.navigateTo({ url: '/pages/order/detail?orderId=' + orderId })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding: 16rpx 0;
}

.order-card {
  background-color: #fff;
  margin: 16rpx 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.order-id {
  font-size: 24rpx;
  color: #999;
}
.order-status {
  font-size: 26rpx;
  font-weight: bold;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.status-unpaid {
  color: #ff3b30;
  background-color: #FFF0F0;
}
.status-waiting {
  color: #FF6B35;
  background-color: #FFF3EE;
}
.status-cooking {
  color: #faad14;
  background-color: #FFFBE6;
}
.status-delivering {
  color: #1890ff;
  background-color: #E6F7FF;
}
.status-done {
  color: #52c41a;
  background-color: #F6FFED;
}
.status-cancelled {
  color: #999;
  background-color: #f5f5f5;
}
.pay-action {
  background: linear-gradient(135deg, #ff3b30, #ff6b5a);
}
.cancel-action {
  background: #fff;
  border: 1rpx solid #999;
  margin-left: 12rpx;
}
.cancel-action .action-btn-text {
  color: #666;
}

.order-foods {
  margin-bottom: 16rpx;
}
.food-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
}
.food-name {
  font-size: 28rpx;
  color: #333;
}
.food-price {
  font-size: 28rpx;
  color: #666;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #f5f5f5;
}
.order-time {
  font-size: 22rpx;
  color: #999;
}
.order-footer-right {
  display: flex;
  align-items: center;
}
.order-total {
  font-size: 28rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-right: 16rpx;
}
.action-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
}
.action-btn-text {
  color: #fff;
  font-size: 24rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}
.empty-icon {
  font-size: 80rpx;
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
.login-btn {
  margin-top: 30rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 16rpx 60rpx;
  border-radius: 40rpx;
}
.login-btn-text {
  color: #fff;
  font-size: 28rpx;
}
</style>
