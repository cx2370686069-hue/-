<template>
  <view class="container">
    <view class="tab-bar">
      <text
        v-for="(tab, index) in tabs"
        :key="index"
        :class="['tab-item', currentTab === index && 'tab-active']"
        @click="switchTab(index)"
      >
        {{ tab.label }}
        <text class="tab-badge" v-if="tab.count > 0">{{ tab.count }}</text>
      </text>
    </view>

    <view class="order-list" v-if="currentList.length > 0">
      <view class="order-card" v-for="order in currentList" :key="order.订单ID">
        <view class="order-header">
          <text class="order-id">{{ order.订单ID }}</text>
          <text :class="['order-status', statusClass(order.状态)]">{{ order.状态 }}</text>
        </view>

        <view class="order-user">
          <text class="user-icon">👤</text>
          <text class="user-name">{{ order.用户昵称 || '用户' }}</text>
          <text class="user-phone">{{ order.联系电话 }}</text>
        </view>

        <view class="order-foods">
          <view class="food-row" v-for="(food, i) in order.商品列表" :key="i">
            <text class="food-name">{{ food.商品名称 }} x{{ food.数量 }}</text>
            <text class="food-price">¥{{ (food.价格 * food.数量).toFixed(2) }}</text>
          </view>
        </view>

        <view class="order-addr" v-if="order.收货地址">
          <text class="addr-icon">📍</text>
          <text class="addr-text">{{ order.收货地址 }}</text>
        </view>

        <view class="order-remark" v-if="order.备注">
          <text class="remark-icon">📝</text>
          <text class="remark-text">{{ order.备注 }}</text>
        </view>

        <view class="order-footer">
          <text class="order-time">{{ order.创建时间 }}</text>
          <view class="order-footer-right">
            <text class="order-total">¥{{ order.总价 }}</text>
            <view class="action-btn" v-if="order.状态 === '待接单'" @click="handleAccept(order.订单ID)">
              <text class="action-btn-text">立即接单</text>
            </view>
            <view class="action-btn cooking-btn" v-if="order.状态 === '备餐中'">
              <text class="action-btn-text">备餐中...</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📋</text>
      <text class="empty-text">{{ tabs[currentTab].emptyText }}</text>
    </view>
  </view>
</template>

<script>
import { getOrderList, acceptOrder } from '@/api/order.js'
import { ORDER_STATUS_CLASS } from '@/config/index.js'
import { initSocket, onNewOrder, offNewOrder, getSocket } from '@/utils/socket.js'
import { getToken, getUser } from '@/utils/auth.js'

export default {
  data() {
    return {
      currentTab: 0,
      allOrders: [],
      tabs: [
        { label: '待接单', status: '待接单', count: 0, emptyText: '暂无待接订单' },
        { label: '备餐中', status: '备餐中', count: 0, emptyText: '暂无备餐订单' },
        { label: '配送中', status: '配送中', count: 0, emptyText: '暂无配送订单' },
        { label: '已完成', status: '已完成', count: 0, emptyText: '暂无已完成订单' },
        { label: '全部', status: '', count: 0, emptyText: '暂无订单' }
      ],
      _newOrderHandler: null
    }
  },
  computed: {
    currentList() {
      const status = this.tabs[this.currentTab].status
      if (!status) return this.allOrders
      return this.allOrders.filter(o => o.状态 === status)
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
      this.loadOrders()
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
    this.loadOrders()
  },
  methods: {
    async loadOrders() {
      try {
        const res = await getOrderList()
        this.allOrders = res?.data?.订单列表 || res?.data?.data || res?.订单列表 || res?.data || []
        this.tabs[0].count = this.allOrders.filter(o => o.状态 === '待接单').length
        this.tabs[1].count = this.allOrders.filter(o => o.状态 === '备餐中').length
        this.tabs[2].count = this.allOrders.filter(o => o.状态 === '配送中').length
        this.tabs[3].count = this.allOrders.filter(o => o.状态 === '已完成').length
        this.tabs[4].count = this.allOrders.length
      } catch (e) {}
    },
    switchTab(index) {
      this.currentTab = index
    },
    statusClass(status) {
      return ORDER_STATUS_CLASS[status] || ''
    },
    async handleAccept(orderId) {
      uni.showModal({
        title: '确认接单',
        content: '接单后请尽快备餐',
        success: async (res) => {
          if (res.confirm) {
            try {
              await acceptOrder(orderId, {
                merchant_lng: 115.681123,
                merchant_lat: 32.181234,
                shop_id: 1 // 临时写死 shop_id
              })
              uni.showToast({ title: '已接单', icon: 'success' })
              this.loadOrders()
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
}

.tab-bar {
  display: flex;
  background-color: #fff;
  padding: 0 10rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: #666;
  border-bottom: 4rpx solid transparent;
  position: relative;
}
.tab-active {
  color: #FF6B35;
  font-weight: bold;
  border-bottom-color: #FF6B35;
}
.tab-badge {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  background-color: #ff3b30;
  color: #fff;
  font-size: 18rpx;
  min-width: 28rpx;
  height: 28rpx;
  line-height: 28rpx;
  text-align: center;
  border-radius: 14rpx;
  padding: 0 6rpx;
  font-weight: normal;
}

.order-list {
  padding: 16rpx 20rpx;
}
.order-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
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
  font-size: 24rpx;
  font-weight: bold;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.status-unpaid { color: #ff3b30; background-color: #FFF0F0; }
.status-waiting { color: #FF6B35; background-color: #FFF3EE; }
.status-cooking { color: #faad14; background-color: #FFFBE6; }
.status-delivering { color: #1890ff; background-color: #E6F7FF; }
.status-done { color: #52c41a; background-color: #F6FFED; }
.status-cancelled { color: #999; background-color: #f5f5f5; }

.order-user {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}
.user-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}
.user-name {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  margin-right: 16rpx;
}
.user-phone {
  font-size: 24rpx;
  color: #666;
}

.order-foods {
  margin-bottom: 12rpx;
  padding: 12rpx 16rpx;
  background-color: #FAFAFA;
  border-radius: 10rpx;
}
.food-row {
  display: flex;
  justify-content: space-between;
  padding: 6rpx 0;
}
.food-name {
  font-size: 26rpx;
  color: #333;
}
.food-price {
  font-size: 26rpx;
  color: #666;
}

.order-addr, .order-remark {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8rpx;
}
.addr-icon, .remark-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}
.addr-text, .remark-text {
  font-size: 24rpx;
  color: #999;
  line-height: 1.5;
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
  color: #ccc;
}
.order-footer-right {
  display: flex;
  align-items: center;
}
.order-total {
  font-size: 30rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-right: 16rpx;
}
.action-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 12rpx 28rpx;
  border-radius: 30rpx;
}
.cooking-btn {
  background: linear-gradient(135deg, #faad14, #ffc53d);
}
.action-btn-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
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
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}
</style>
