<template>
  <view class="container">
    <!-- 顶部状态栏 -->
    <view class="header">
      <view class="header-left">
        <text class="header-emoji">🛵</text>
        <view class="header-info">
          <text class="header-title">骑手工作台</text>
          <text class="header-sub">{{ nickname }}，今天也辛苦了</text>
        </view>
      </view>
      <view class="status-switch" @click="toggleOnline">
        <text class="switch-text" :class="{ 'highlight-online': isOnline }">{{ isOnline ? '接单中' : '已休息' }}</text>
        <view class="switch-dot" :class="{online: isOnline}"></view>
      </view>
    </view>

    <!-- 数据统计 -->
    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-num">{{ stats.todayDone }}</text>
        <text class="stat-label">今日完成</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ stats.delivering }}</text>
        <text class="stat-label">配送中</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">¥{{ stats.todayEarning }}</text>
        <text class="stat-label">完成订单收入统计</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="section-title-small">📦 订单管理</view>
      <view class="menu-grid">
        <view class="menu-item" @click="goOrders">
          <view class="menu-icon-wrap" style="background-color: #E6F7FF;">
            <text class="menu-icon">📋</text>
          </view>
          <text class="menu-text">外卖订单</text>
          <text class="menu-badge" v-if="stats.pending > 0">{{ stats.pending }}</text>
        </view>
        <view class="menu-item" @click="goErrands">
          <view class="menu-icon-wrap" style="background-color: #FFF7E6;">
            <text class="menu-icon">🏃</text>
          </view>
          <text class="menu-text">跑腿订单</text>
          <text class="menu-badge" v-if="stats.errandPending > 0">{{ stats.errandPending }}</text>
        </view>
        <view class="menu-item" @click="goTodayOrders">
          <view class="menu-icon-wrap" style="background-color: #F0F5FF;">
            <text class="menu-icon">📊</text>
          </view>
          <text class="menu-text">今日订单</text>
          <text class="menu-badge" v-if="stats.todayDone > 0">{{ stats.todayDone }}</text>
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="section-title-small">💰 订单收入统计</view>
      <view class="menu-grid">
        <view class="menu-item" @click="goEarnings">
          <view class="menu-icon-wrap" style="background-color: #F6FFED;">
            <text class="menu-icon">💰</text>
          </view>
          <text class="menu-text">订单收入汇总</text>
        </view>
        <view class="menu-item" @click="goWeekStats">
          <view class="menu-icon-wrap" style="background-color: #FFF0F6;">
            <text class="menu-icon">📈</text>
          </view>
          <text class="menu-text">本周统计</text>
        </view>
        <view class="menu-item" @click="goMonthStats">
          <view class="menu-icon-wrap" style="background-color: #FCF0FF;">
            <text class="menu-icon">📅</text>
          </view>
          <text class="menu-text">本月统计</text>
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="section-title-small">🛠️ 我的服务</view>
      <view class="menu-grid">
        <view class="menu-item" @click="goProfile">
          <view class="menu-icon-wrap" style="background-color: #E6FFFB;">
            <text class="menu-icon">👤</text>
          </view>
          <text class="menu-text">个人中心</text>
        </view>
        <view v-if="showStationMessageEntry" class="menu-item" @click="goStationMessages">
          <view class="menu-icon-wrap" style="background-color: #FFF1F0;">
            <text class="menu-icon">💬</text>
          </view>
          <text class="menu-text">跑腿代购消息</text>
          <text class="menu-badge" v-if="stationMessageUnread > 0">{{ formatBadgeCount(stationMessageUnread) }}</text>
        </view>
        <view class="menu-item" @click="goSettings">
          <view class="menu-icon-wrap" style="background-color: #FFF7E6;">
            <text class="menu-icon">⚙️</text>
          </view>
          <text class="menu-text">设置</text>
        </view>
        <view class="menu-item" @click="goHelp">
          <view class="menu-icon-wrap" style="background-color: #F0F5FF;">
            <text class="menu-icon">❓</text>
          </view>
          <text class="menu-text">帮助中心</text>
        </view>
      </view>
    </view>

    <!-- 待处理订单提醒 -->
    <view class="section" v-if="pendingOrders.length > 0">
      <view class="section-header">
        <text class="section-title">配送任务</text>
        <text class="section-action" @click="goOrders">查看全部</text>
      </view>
      <view class="order-card" v-for="order in pendingOrders.slice(0, 3)" :key="order.id" @click="goOrderDetail(order)">
        <view class="order-top">
          <view class="order-tags">
            <text class="order-type" :class="{ 'town-type': isTownOrder(order) }">
              {{ isTownOrder(order) ? '乡镇订单' : (order.type === 'takeout' ? '外卖' : '配送') }}
            </text>
            <text v-if="getTownName(order)" class="order-town">{{ getTownName(order) }}</text>
          </view>
          <text class="order-price">¥{{ order.rider_fee || 0 }}</text>
        </view>
        <view class="order-merchant">
          <text class="merchant-icon">🏪</text>
          <text class="merchant-text">{{ order.merchant?.name || '未知商家' }}</text>
        </view>
        <view class="order-addr">
          <text class="addr-icon">📍</text>
          <text class="addr-text">{{ getBriefAddress(order) }}</text>
        </view>
        <view class="order-bottom">
          <text class="order-status" :class="{ 'town-status': isTownOrder(order) }">{{ getStatusText(order.status) }}</text>
          <text class="order-time">{{ formatTime(order.created_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-if="pendingOrders.length === 0 && isOnline">
      <text class="empty-icon">☕</text>
      <text class="empty-text">暂无待处理订单</text>
      <text class="empty-tip">当前没有分配到你的配送任务</text>
    </view>

    <!-- 自定义确认弹窗 -->
    <view class="confirm-dialog" v-if="showConfirmDialog">
      <view class="dialog-mask" @click="cancelOffWork"></view>
      <view class="dialog-content">
        <view class="dialog-title">提示</view>
        <view class="dialog-message">确定现在下班吗？</view>
        <view class="dialog-buttons">
          <button 
            class="dialog-btn confirm-btn" 
            :class="{ disabled: countdown > 0 }"
            @click="confirmOffWork"
          >
            {{ countdown > 0 ? `确定 (${countdown}s)` : '确定' }}
          </button>
          <button 
            class="dialog-btn cancel-btn" 
            @click="cancelOffWork"
          >
            取消
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getRiderOrders, updateRiderStatus } from '@/api/order.js'
import { getErrandList } from '@/api/errand.js'
import { getTownErrandConversations } from '@/api/town-errand-message.js'
import { getUserInfo } from '@/api/user.js'
import { ORDER_STATUS } from '@/config/index.js'
import { getRiderStatus, getUserInfo as getStoredUserInfo, setRiderStatus } from '@/utils/storage.js'
import { initSocket, onNewDelivery, disconnectSocket, offAllListeners } from '@/utils/socket.js'
import { formatTime } from '@/utils/index.js'

export default {
  data() {
    return {
      isOnline: true,
      nickname: '骑手',
      userProfile: null,
      stationMessageUnread: 0,
      stationMessagePollTimer: null,
      lastStationMessageUnread: null,
      allOrders: [],
      errandOrders: [],
      stats: {
        todayDone: 0,
        delivering: 0,
        todayEarning: '0.00',
        pending: 0,
        errandPending: 0
      },
      // 确认弹窗相关
      showConfirmDialog: false,
      countdown: 5,
      countdownTimer: null
    }
  },
  computed: {
    pendingOrders() {
      return this.allOrders.filter(o => [4, 5].includes(Number(o.status)))
    },
    showStationMessageEntry() {
      const profile = this.userProfile || {}
      return profile.rider_kind === 'stationmaster' || profile.delivery_scope === 'town_delivery'
    }
  },
  onLoad() {
    // 加载骑手状态
    const savedStatus = getRiderStatus()
    this.isOnline = savedStatus === 1
    const storedUser = getStoredUserInfo()
    if (storedUser) {
      this.userProfile = storedUser
      this.nickname = storedUser.nickname || '骑手'
    }
  },
  onShow() {
    this.initOrderSocket()
    this.loadData()
  },
  onHide() {
    this.destroyOrderSocket()
    this.stopStationMessagePolling()
  },
  onUnload() {
    this.destroyOrderSocket()
    this.stopStationMessagePolling()
  },
  methods: {
    formatTime,
    formatBadgeCount(count) {
      return count > 99 ? '99+' : String(count)
    },
    getStatusText(status) {
      return ORDER_STATUS[status]?.text || '未知状态'
    },
    isTownOrder(order = {}) {
      return order.order_type === 'town' || order.delivery_scope === 'town_delivery' || !!this.getTownName(order)
    },
    getTownName(order = {}) {
      return order.customer_town || order.town_name || order.rider_town || ''
    },
    
    async loadData() {
      await this.loadUserInfo()
      await Promise.all([
        this.loadOrders(),
        this.loadErrands(),
        this.loadStationMessageSummary(true)
      ])
      this.calculateStats()
      this.startStationMessagePolling()
    },
    
    async loadUserInfo() {
      try {
        const res = await getUserInfo()
        if (res.data) {
          this.userProfile = res.data
          this.nickname = res.data.nickname || '骑手'
        }
      } catch (e) {
        console.error('加载用户信息失败', e)
      }
    },
    
    async loadOrders() {
      try {
        const res = await getRiderOrders()
        this.allOrders = res.data || []
      } catch (e) {
        console.error('加载订单失败', e)
        this.allOrders = []
      }
    },
    
    async loadErrands() {
      try {
        const res = await getErrandList({ status: 1 })
        this.errandOrders = res.data || []
      } catch (e) {
        console.error('加载跑腿订单失败', e)
        this.errandOrders = []
      }
    },
    async loadStationMessageSummary(isFirstLoad = false) {
      if (!this.showStationMessageEntry) {
        this.stationMessageUnread = 0
        this.lastStationMessageUnread = 0
        return
      }
      try {
        const res = await getTownErrandConversations()
        const source = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.list)
            ? res.data.list
            : Array.isArray(res?.data?.rows)
              ? res.data.rows
              : Array.isArray(res?.data?.data)
                ? res.data.data
                : Array.isArray(res)
                  ? res
                  : []
        const unreadTotal = source.reduce((sum, item = {}) => {
          const unread = Number(item.unread_count ?? item.unreadCount ?? item.unread_num ?? 0)
          return sum + (unread > 0 ? unread : 0)
        }, 0)
        const previousUnread = this.lastStationMessageUnread
        this.stationMessageUnread = unreadTotal
        this.lastStationMessageUnread = unreadTotal
      } catch (error) {
        console.error('加载站长消息未读数失败', error)
      }
    },
    startStationMessagePolling() {
      this.stopStationMessagePolling()
      if (!this.showStationMessageEntry) {
        return
      }
      this.stationMessagePollTimer = setInterval(() => {
        this.loadStationMessageSummary(false)
      }, 3000)
    },
    stopStationMessagePolling() {
      if (this.stationMessagePollTimer) {
        clearInterval(this.stationMessagePollTimer)
        this.stationMessagePollTimer = null
      }
    },
    
    calculateStats() {
      const today = new Date().toISOString().slice(0, 10)
      
      // 统计外卖订单
      const todayDoneList = this.allOrders.filter(o => 
        o.status === 6 && 
        o.delivered_at && 
        o.delivered_at.startsWith(today)
      )
      
      const deliveringList = this.allOrders.filter(o => o.status === 5)
      
      this.stats.todayDone = todayDoneList.length
      this.stats.delivering = deliveringList.length
      this.stats.todayEarning = todayDoneList.reduce((sum, o) => {
        return sum + (parseFloat(o.rider_fee) || 0)
      }, 0).toFixed(2)
      this.stats.pending = this.pendingOrders.length
      
      // 统计跑腿订单
      this.stats.errandPending = this.errandOrders.length
    },
    
    async toggleOnline() {
      // 如果是从接单中切换到休息，弹出确认框
      if (this.isOnline) {
        this.showConfirmDialog = true
        this.countdown = 5
        
        // 启动倒计时
        this.countdownTimer = setInterval(() => {
          this.countdown--
          if (this.countdown <= 0) {
            clearInterval(this.countdownTimer)
          }
        }, 1000)
      } else {
        try {
          const newStatus = 1
          await updateRiderStatus(newStatus)
          this.isOnline = true
          setRiderStatus(newStatus)
          uni.showToast({ 
            title: '已开始接单', 
            icon: 'none' 
          })
        } catch (error) {
          console.error('切换接单状态失败', error)
        }
      }
    },
    
    // 确认下班
    async confirmOffWork() {
      if (this.countdown > 0) {
        uni.showToast({
          title: '请等待倒计时结束',
          icon: 'none'
        })
        return
      }
      
      try {
        const newStatus = 0
        await updateRiderStatus(newStatus)
        setRiderStatus(newStatus)
        this.isOnline = false
        this.showConfirmDialog = false
        
        uni.showToast({ 
          title: '已暂停接单', 
          icon: 'none' 
        })
      } catch (error) {
        console.error('切换休息状态失败', error)
      }
    },
    
    // 取消下班
    cancelOffWork() {
      this.showConfirmDialog = false
      clearInterval(this.countdownTimer)
    },
    
    getBriefAddress(order) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address
        return addr.detail || addr.address || `${addr.district || ''}${addr.street || ''}` || order.address || '未知地址'
      } catch (e) {
        return order.address || '未知地址'
      }
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
        await this.loadOrders()
        this.calculateStats()
      })
    },
    destroyOrderSocket() {
      offAllListeners()
      disconnectSocket()
    },
    
    goOrders() {
      // orders 是 tabbar 页面，需要用 switchTab
      uni.switchTab({ url: '/pages/orders/index' })
    },
    
    goErrands() {
      uni.navigateTo({ url: '/pages/errands/index' })
    },
    
    goTodayOrders() {
      uni.switchTab({ url: '/pages/orders/index' })
    },
    
    goEarnings() {
      uni.navigateTo({ url: '/pages/earnings/index' })
    },
    
    goWeekStats() {
      uni.navigateTo({ url: '/pages/earnings/index?period=week' })
    },
    
    goMonthStats() {
      uni.navigateTo({ url: '/pages/earnings/index?period=month' })
    },
    
    goProfile() {
      // profile 是 tabbar 页面，需要用 switchTab
      uni.switchTab({ url: '/pages/profile/index' })
    },

    goStationMessages() {
      uni.navigateTo({ url: '/pages/station-messages/index' })
    },
    
    goSettings() {
      uni.showToast({ title: '设置功能开发中', icon: 'none' })
    },
    
    goHelp() {
      uni.showToast({ title: '帮助中心开发中', icon: 'none' })
    },
    
    goOrderDetail(order) {
      const target = order.type === 'errand' ? 'errands' : 'orders'
      uni.navigateTo({ 
        url: `/pages/${target}/detail?id=${order.id}` 
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20rpx;
}

.header {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  padding: 40rpx 30rpx 36rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-emoji {
  font-size: 50rpx;
  margin-right: 16rpx;
}

.header-info {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.header-sub {
  font-size: 22rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 6rpx;
}

.status-switch {
  display: flex;
  align-items: center;
  background-color: rgba(255,255,255,0.2);
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.switch-text {
  font-size: 28rpx;
  color: #fff;
  margin-right: 10rpx;
  font-weight: 500;
}

.switch-text.highlight-online {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10rpx rgba(255, 255, 255, 0.8);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}

.switch-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background-color: #999;
}

.switch-dot.online {
  background-color: #52c41a;
}

.stats-grid {
  display: flex;
  margin: 20rpx;
  gap: 16rpx;
}

.stat-card {
  flex: 1;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #1890ff;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}

.menu-section {
  background-color: #fff;
  margin: 0 20rpx 20rpx;
  border-radius: 20rpx;
  padding: 24rpx 20rpx 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.section-title-small {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.menu-grid {
  display: flex;
  gap: 10rpx;
}

.menu-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 16rpx 8rpx;
}

.menu-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
}

.menu-icon {
  font-size: 48rpx;
}

.menu-text {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.menu-badge {
  position: absolute;
  top: -6rpx;
  right: 20rpx;
  background-color: #ff3b30;
  color: #fff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;
  padding: 0 8rpx;
}

.section {
  background-color: #fff;
  margin: 0 20rpx 20rpx;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.section-action {
  font-size: 24rpx;
  color: #1890ff;
}

.order-card {
  padding: 20rpx;
  background-color: #FAFAFA;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  border-left: 6rpx solid #1890ff;
}

.order-tags {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.order-card:last-child {
  margin-bottom: 0;
}

.order-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.order-type {
  font-size: 24rpx;
  color: #fff;
  background: #1890ff;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.order-type.town-type {
  background: #1f6f43;
}

.order-town {
  font-size: 22rpx;
  color: #1f6f43;
  background: rgba(31, 111, 67, 0.12);
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.order-price {
  font-size: 30rpx;
  color: #FF6B35;
  font-weight: bold;
}

.order-merchant {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.merchant-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
}

.merchant-text {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.order-addr {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10rpx;
}

.addr-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
}

.addr-text {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

.order-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 22rpx;
  color: #ccc;
}

.order-status {
  font-size: 24rpx;
  color: #1890ff;
  font-weight: 500;
}

.order-status.town-status {
  color: #1f6f43;
}

.take-btn {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  padding: 10rpx 28rpx;
  border-radius: 30rpx;
}

.take-btn-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
}

.empty-section, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
  margin-top: 20rpx;
}

.empty-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 10rpx;
}

/* 自定义确认弹窗样式 */
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  position: relative;
  background-color: #fff;
  border-radius: 24rpx;
  width: 600rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.3);
  animation: dialogFadeIn 0.3s ease;
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 24rpx;
}

.dialog-message {
  font-size: 32rpx;
  color: #666;
  text-align: center;
  margin-bottom: 48rpx;
  line-height: 1.6;
}

.dialog-buttons {
  display: flex;
  gap: 24rpx;
}

.dialog-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-btn {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: #fff;
}

.confirm-btn.disabled {
  background: #cccccc;
  color: #999999;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}
</style>
