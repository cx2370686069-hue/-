<template>
  <view class="container">
    <!-- 状态筛选 -->
    <view class="status-tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view 
          v-for="item in statusTabs" 
          :key="item.key"
          class="tab-item"
          :class="{ active: currentStatus === item.key }"
          @click="switchStatus(item.key)"
        >
          {{ item.label }}
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <scroll-view 
      scroll-y 
      class="order-scroll"
      @scrolltolower="loadMore"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="orderList.length" class="order-list">
        <view 
          v-for="order in orderList" 
          :key="order.id"
          class="order-card"
          :class="{ 'highlight-card': order.status === 1 || order.status === 4, 'town-order-card': isTownOrder(order) }"
          @click="goDetail(order)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <view class="header-left">
              <view class="order-info-row">
                <text class="order-no">{{ order.order_no }}</text>
                <view class="header-tags">
                  <view v-if="isTownOrder(order)" class="scope-tag">乡镇订单</view>
                  <view class="status-tag" :style="{ backgroundColor: getStatusColor(order.status, order) }">
                    {{ getStatusText(order.status) }}
                  </view>
                </view>
              </view>
              <text class="order-time">{{ formatTime(order.created_at) }}</text>
            </view>
          </view>

          <!-- 配送费（突出显示） -->
          <view class="delivery-fee-section">
            <text class="fee-label">💰 配送费</text>
            <text class="fee-num">¥{{ order.rider_fee || 0 }}</text>
          </view>

          <!-- 商家信息 -->
          <view class="simple-info">
            <text class="info-icon">🏪</text>
            <text class="info-text">{{ order.merchant?.name || '未知商家' }}</text>
            <text class="call-btn" @click.stop="callMerchant(order.merchant?.phone)">📞 打电话</text>
          </view>

          <!-- 配送地址（简化） -->
          <view class="simple-info">
            <text class="info-icon">📍</text>
            <text class="info-text address-text">{{ getBriefAddress(order) }}</text>
          </view>

          <view class="simple-info" v-if="getTownName(order)">
            <text class="info-icon">🌲</text>
            <text class="info-text">{{ getTownName(order) }}</text>
          </view>

          <view class="simple-info">
            <text class="info-icon">🧭</text>
            <text class="info-text">商家 {{ formatCoordinate(getMerchantCoords(order)) }}</text>
          </view>

          <view class="simple-info">
            <text class="info-icon">📌</text>
            <text class="info-text">用户 {{ formatCoordinate(getCustomerCoords(order)) }}</text>
          </view>

          <!-- 操作按钮 -->
          <view class="order-actions">
            <button
              v-if="canPickup(order.status)"
              class="btn btn-primary"
              @click.stop="handlePickup(order)"
            >
              取餐配送
            </button>
            <button 
              v-if="canRiderCallConfirmDeliveryApi(order.status)" 
              class="btn btn-success"
              @click.stop="handleStandardDelivery(order)"
            >
              确认送达
            </button>
            <button 
              v-else-if="canRiderOfferSpecialComplete(order.status)" 
              class="btn btn-special"
              @click.stop="handleSpecialComplete(order)"
            >
              特殊完结
            </button>
            <button 
              class="btn btn-default"
              @click.stop="goDetail(order)"
            >
              查看详情
            </button>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无订单</text>
        <text class="empty-tip">
          {{ currentStatus === '' ? '当前没有分配到你的配送订单' : '该状态下暂无订单' }}
        </text>
      </view>

      <!-- 加载更多 -->
      <view v-if="loadingMore" class="load-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  getRiderOrders,
  riderPickup as riderPickupApi,
  confirmDelivery as confirmDeliveryApi,
  confirmDeliverySpecial as confirmDeliverySpecialApi
} from '@/api/order.js'
import {
  ORDER_STATUS,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete
} from '@/config/index.js'
import { initSocket, onNewDelivery, disconnectSocket, offAllListeners } from '@/utils/socket.js'
import { formatTime } from '@/utils/index.js'

export default {
  data() {
    return {
      currentStatus: '',
      statusTabs: [
        { key: '', label: '全部', count: 0 },
        { key: '1', label: '待处理', count: 0 },
        { key: '4', label: '备货完成', count: 0 },
        { key: '5', label: '配送中', count: 0 },
        { key: '6', label: '已完成', count: 0 }
      ],
      orderList: [],
      page: 1,
      pageSize: 10,
      refreshing: false,
      loadingMore: false
    }
  },
  onLoad() {
    this.loadOrderList()
  },
  onShow() {
    this.initOrderSocket()
    this.loadOrderList()
  },
  onHide() {
    this.destroyOrderSocket()
  },
  onUnload() {
    this.destroyOrderSocket()
  },
  methods: {
    formatTime,
    canRiderCallConfirmDeliveryApi,
    canRiderOfferSpecialComplete,

    getStatusText(status) {
      return ORDER_STATUS[status]?.text || '未知'
    },
    
    getStatusColor(status, order = {}) {
      if (this.isTownOrder(order)) {
        const townStatusColors = {
          4: '#1f6f43',
          5: '#2b8a57',
          6: '#2b8a57'
        }
        return townStatusColors[Number(status)] || ORDER_STATUS[status]?.color || '#999'
      }
      return ORDER_STATUS[status]?.color || '#999'
    },
    isTownOrder(order = {}) {
      return order.order_type === 'town' || order.delivery_scope === 'town_delivery' || !!this.getTownName(order)
    },
    getTownName(order = {}) {
      return order.customer_town || order.town_name || order.rider_town || ''
    },
    getCoordinateByKeys(source = {}, keys = []) {
      for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
      return ''
    },
    getMerchantCoords(order = {}) {
      const merchant = order.merchant || {}
      return {
        lng: this.getCoordinateByKeys(order, ['merchant_lng', 'merchantLng']) || this.getCoordinateByKeys(merchant, ['longitude', 'lng']),
        lat: this.getCoordinateByKeys(order, ['merchant_lat', 'merchantLat']) || this.getCoordinateByKeys(merchant, ['latitude', 'lat'])
      }
    },
    getCustomerCoords(order = {}) {
      return {
        lng: this.getCoordinateByKeys(order, ['customer_lng', 'delivery_longitude', 'longitude', 'lng']),
        lat: this.getCoordinateByKeys(order, ['customer_lat', 'delivery_latitude', 'latitude', 'lat'])
      }
    },
    formatCoordinate(coords = {}) {
      if (coords.lng === '' || coords.lat === '') {
        return '未提供坐标'
      }
      return `${coords.lng}, ${coords.lat}`
    },
    canPickup(status) {
      return Number(status) === 4
    },
    
    getFullAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        return addr.province + addr.city + addr.district + addr.street + addr.detail
      } catch (e) {
        return '未知地址'
      }
    },
    
    getBriefAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        // 只显示区和街道，更简洁
        return (addr.district || '') + (addr.street || '') || '未知地址'
      } catch (e) {
        return '未知地址'
      }
    },
    
    switchStatus(status) {
      this.currentStatus = status
      this.page = 1
      this.loadOrderList()
    },
    
    async loadOrderList() {
      try {
        const params = {}
        if (this.currentStatus !== '') {
          params.status = this.currentStatus
        }
        
        const res = await getRiderOrders(params)
        const list = res.data || []
        
        this.orderList = list
        this.updateStatusCounts()
      } catch (e) {
        console.error('加载订单失败', e)
        this.orderList = []
      }
    },
    
    updateStatusCounts() {
      const counter = {}
      this.orderList.forEach(order => {
        counter[order.status] = (counter[order.status] || 0) + 1
      })
      
      this.statusTabs = this.statusTabs.map(tab => ({
        ...tab,
        count: tab.key === '' ? this.orderList.length : (counter[tab.key] || 0)
      }))
    },
    
    async onRefresh() {
      this.refreshing = true
      this.page = 1
      await this.loadOrderList()
      this.refreshing = false
    },
    
    loadMore() {
      if (this.loadingMore) return
      this.loadingMore = true
      this.page++
      // TODO: 实现分页加载
      this.loadingMore = false
    },
    initOrderSocket() {
      const token = uni.getStorageSync('token') || ''
      if (!token) {
        return
      }
      initSocket(token)
      offAllListeners()
      onNewDelivery(async (payload = {}) => {
        const order = payload.data || {}
        if (!order.id) {
          return
        }
        uni.showToast({
          title: this.isTownOrder(order) ? '收到乡镇配送任务' : '收到新的配送任务',
          icon: 'none',
          duration: 2000
        })
        await this.loadOrderList()
      })
    },
    destroyOrderSocket() {
      offAllListeners()
      disconnectSocket()
    },
    handlePickup(order) {
      uni.showModal({
        title: '确认取餐',
        content: '确认已到店取餐并开始配送？',
        confirmText: '开始配送',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!this.canPickup(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await riderPickupApi(fresh.id)
            uni.showToast({ title: '已开始配送', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('取餐失败', e)
          }
        }
      })
    },
    
    handleStandardDelivery(order) {
      uni.showModal({
        title: '确认送达',
        content: '确认订单已送达？',
        confirmText: '确认送达',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!canRiderCallConfirmDeliveryApi(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await confirmDeliveryApi(fresh.id)
            uni.showToast({ title: '送达成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('确认送达失败', e)
          }
        }
      })
    },
    handleSpecialComplete(order) {
      uni.showModal({
        title: '特殊完结',
        content: '确认按「特殊完结」处理该订单？',
        confirmText: '特殊完结',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          const fresh = this.orderList.find((o) => o.id === order.id) || order
          if (!canRiderOfferSpecialComplete(fresh.status)) {
            uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
            return
          }
          try {
            await confirmDeliverySpecialApi(fresh.id)
            uni.showToast({ title: '操作成功', icon: 'success' })
            await this.loadOrderList()
          } catch (e) {
            console.error('特殊完结失败', e)
          }
        }
      })
    },
    
    callMerchant(phone) {
      if (phone) {
        uni.makePhoneCall({ phoneNumber: phone })
      }
    },
    
    goDetail(order) {
      uni.navigateTo({ 
        url: `/pages/orders/detail?id=${order.id}` 
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.status-tabs {
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.tabs-scroll {
  white-space: nowrap;
  padding: 0 20rpx;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 24rpx 20rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.active {
  color: #1890ff;
  font-weight: 500;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20rpx;
  right: 20rpx;
  height: 4rpx;
  background: #1890ff;
  border-radius: 2rpx;
}

.order-scroll {
  height: calc(100vh - 100rpx);
}

.order-list {
  padding: 20rpx;
}

.order-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  border-left: 8rpx solid transparent;
}

.order-card.highlight-card {
  border-left-color: #ff6b35;
  background: linear-gradient(135deg, #fff 0%, #fff7f5 100%);
}

.order-card.town-order-card {
  border-left-color: #1f6f43;
  background: linear-gradient(135deg, #fff 0%, #f2fbf5 100%);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.header-left {
  flex: 1;
}

.order-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.scope-tag {
  font-size: 24rpx;
  color: #fff;
  background: #1f6f43;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.order-no {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.order-time {
  font-size: 22rpx;
  color: #999;
  display: block;
}

.status-tag {
  font-size: 26rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  color: #fff;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 16rpx;
}

/* 配送费区域（突出显示） */
.delivery-fee-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #fff7e6, #fff);
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid #ffd591;
}

.fee-label {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.fee-num {
  font-size: 44rpx;
  color: #ff6b35;
  font-weight: bold;
}

/* 简化信息区域 */
.simple-info {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.simple-info:last-child {
  border-bottom: none;
}

.info-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.info-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.address-text {
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-btn {
  font-size: 26rpx;
  color: #1890ff;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.merchant-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.merchant-name {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.merchant-phone {
  font-size: 32rpx;
  color: #1890ff;
  padding: 8rpx 16rpx;
}

.delivery-info {
  margin-bottom: 16rpx;
}

.info-label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
}

.order-amount {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.amount-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 12rpx;
}

.amount-num {
  font-size: 32rpx;
  color: #FF6B35;
  font-weight: bold;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.btn {
  padding: 16rpx 32rpx;
  font-size: 26rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
}

.btn-special {
  background: linear-gradient(135deg, #fa8c16, #ffc069);
  color: #fff;
}

.btn-default {
  background: #f5f5f5;
  color: #666;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #999;
}

.load-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #999;
}
</style>
