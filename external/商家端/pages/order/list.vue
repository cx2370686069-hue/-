<template>
  <view class="container">
    <!-- 顶部统计卡片 -->
    <view class="stats-card">
      <view class="stats-item">
        <text class="stats-num">{{ todayStats.orderCount }}</text>
        <text class="stats-label">今日订单</text>
      </view>
      <view class="stats-item">
        <text class="stats-num">¥{{ todayStats.income }}</text>
        <text class="stats-label">今日收入</text>
      </view>
      <view class="stats-item">
        <text class="stats-num">{{ todayStats.pendingCount }}</text>
        <text class="stats-label">待处理</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input 
          v-model="searchKey" 
          placeholder="搜索订单号/手机号/顾客姓名" 
          @confirm="onSearch"
        />
        <text v-if="searchKey" class="clear-icon" @click="clearSearch">✕</text>
      </view>

    </view>

    <!-- 日期筛选 -->
    <view class="date-filter">
      <view 
        v-for="item in dateFilters" 
        :key="item.value"
        class="date-item"
        :class="{ active: currentDate === item.value }"
        @click="switchDate(item.value)"
      >
        {{ item.label }}
      </view>
    </view>

    <!-- 订单处理大厅：状态分桶，严禁跨级（1→2→3→4） -->
    <view class="hall-tabs">
      <view
        v-for="tab in hallTabs"
        :key="tab.key"
        class="hall-tab"
        :class="{ active: hallTab === tab.key }"
        @click="switchHallTab(tab.key)"
      >
        <text class="hall-tab-text">{{ tab.label }}</text>
      </view>
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
          :class="{ urgent: order.isUrgent }"
          @click="goDetail(order.id)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <view class="header-left">
              <text class="order-no">{{ order.orderNo }}</text>
              <text class="order-time">{{ order.createTime }}</text>
            </view>
            <view class="status-tag" :class="'status-' + order.status">
              {{ order.statusText }}
            </view>
          </view>

          <!-- 顾客信息 -->
          <view class="customer-info">
            <view class="info-row">
              <text class="label">顾客：</text>
              <text class="value">{{ order.customerName }} {{ order.customerPhone }}</text>
              <text class="call-btn" @click.stop="callCustomer(order.customerPhone)">📞</text>
            </view>
            <view class="info-row">
              <text class="label">地址：</text>
              <text class="value address">{{ order.address }}</text>
            </view>
          </view>

          <!-- 商品列表 -->
          <view class="goods-list">
            <view 
              v-for="(goods, idx) in order.goodsList.slice(0, 3)" 
              :key="idx"
              class="goods-item"
            >
              <image v-if="goods.image" :src="goods.image" class="goods-img" mode="aspectFill" />
              <view v-else class="goods-img placeholder">🍱</view>
              <view class="goods-info">
                <text class="goods-name">{{ goods.name }}</text>
                <text class="goods-spec" v-if="goods.spec">{{ goods.spec }}</text>
              </view>
              <view class="goods-price">
                <text class="num">x{{ goods.num }}</text>
                <text class="price">¥{{ goods.price }}</text>
              </view>
            </view>
            <view v-if="order.goodsList.length > 3" class="more-goods">
              还有{{ order.goodsList.length - 3 }}件商品...
            </view>
          </view>

          <!-- 预计收入：pay_amount - delivery_fee，缺省时用实付 -->
          <view class="order-amount">
            <text class="amount-label">预计收入</text>
            <text class="amount-num">¥{{ order.estimatedIncome }}</text>
            <text class="amount-detail">
              实付¥{{ order.totalAmount }}<text v-if="order.deliveryFee != null"> · 配送¥{{ order.deliveryFee }}</text>
            </text>
          </view>

          <!-- 订单备注（买家备注） -->
          <view v-if="order.remark" class="order-remark">
            <text class="remark-label">买家备注：</text>
            <text class="remark-content">{{ order.remark }}</text>
          </view>

          <!-- 操作按钮（按状态流转，不跨级） -->
          <view class="order-actions">
            <button
              v-if="order.status === 1"
              class="btn btn-primary"
              @click.stop="handleAccept(order)"
            >
              接单
            </button>
            <button
              v-if="order.status === 1"
              class="btn btn-danger"
              @click.stop="rejectOrder(order)"
            >
              拒单
            </button>
            <button
              v-if="order.status === 2"
              class="btn btn-primary"
              @click.stop="finishMake(order)"
            >
              出餐完成
            </button>
            <button
              v-if="(order.status === 3 || order.status === 4) && order.orderType === 'county'"
              class="btn btn-primary"
              @click.stop="submitDeliver(order)"
            >
              {{ order.status === 3 ? '呼叫骑手' : '提交调度' }}
            </button>
            <text v-if="order.status === 3 && order.orderType !== 'county'" class="status-hint">待配送</text>
            <text v-if="order.status === 4 && order.orderType !== 'county'" class="status-hint">配送中</text>
            <!-- 通用按钮 -->
            <button 
              class="btn btn-default"
              @click.stop="printOrder(order)"
            >
              打印
            </button>
            <button 
              class="btn btn-default"
              @click.stop="goDetail(order.id)"
            >
              详情
            </button>
          </view>
        </view>

        <!-- 加载更多 -->
        <view v-if="loadingMore" class="load-more">
          <text>加载中...</text>
        </view>
        <view v-else-if="noMore" class="no-more">
          <text>没有更多订单了</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无订单</text>
        <text class="empty-tip">{{ emptyTip }}</text>
      </view>
    </scroll-view>


  </view>
</template>

<script>
import {
  getDashboard,
  getOrderList,
  acceptOrder as apiAcceptOrder,
  rejectOrder,
  prepareOrder,
  deliverOrder
} from '../../api/index.js'
import { ORDER_STATUS, formatTime } from '../../utils/index.js'
import { initSocket, onNewOrder, offNewOrder, getSocket } from '@/utils/socket.js'
import { getToken, getUser } from '../../utils/auth.js'

export default {
  data() {
    return {
      // 统计数据
      todayStats: {
        orderCount: 0,
        income: '0.00',
        pendingCount: 0
      },
      
      // 搜索
      searchKey: '',
      
      // 日期筛选
      currentDate: 'today',
      dateFilters: [
        { label: '今日', value: 'today' },
        { label: '昨日', value: 'yesterday' },
        { label: '近7天', value: 'week' },
        { label: '近30天', value: 'month' }
      ],
      
      // 订单大厅：新订单(1) / 制作中(2) / 待配送(3与4)
      hallTab: '1',
      hallTabs: [
        { key: '1', label: '新订单(1)' },
        { key: '2', label: '制作中(2)' },
        { key: '34', label: '待配送(3/4)' }
      ],
      
      // 订单列表（已适配后端字段）
      orderList: [],
      page: 1,
      pageSize: 10,
      refreshing: false,
      loadingMore: false,
      noMore: false,
      _newOrderHandler: null
    }
  },
  
  computed: {
    emptyTip() {
      if (this.searchKey) {
        return '未找到匹配的订单'
      }
      return '当前阶段暂无订单'
    }
  },
  
  onLoad() {
    this.loadStats()
    this.loadOrderList()

    const token = getToken()
    const userInfo = getUser()
    const userId = userInfo?.id || userInfo?.userId || ''
    
    if (token && !getSocket()) {
      initSocket(token, userId)
    }
    this._newOrderHandler = () => {
      this.page = 1
      this.loadOrderList()
      this.loadStats()
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
    this.loadStats()
    this.loadOrderList()
  },

  async onPullDownRefresh() {
    try {
      this.page = 1
      this.refreshing = true
      await Promise.all([this.loadOrderList(), this.loadStats()])
    } catch (e) {
      console.error(e)
    } finally {
      this.refreshing = false
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    // 加载统计数据
    async loadStats() {
      try {
        const res = await getDashboard()
        const data = res?.data || res || {}
        this.todayStats = {
          orderCount: Number(data.todayOrders || data.orderCount || 0),
          income: Number(data.todayRevenue || data.income || 0).toFixed(2),
          pendingCount: Number(data.pendingOrders || data.pendingCount || 0)
        }
      } catch (e) {
        this.todayStats = {
          orderCount: 0,
          income: '0.00',
          pendingCount: 0
        }
      }
    },
    
    // 搜索
    onSearch() {
      this.page = 1
      this.loadOrderList()
    },
    
    clearSearch() {
      this.searchKey = ''
      this.page = 1
      this.loadOrderList()
    },
    
    // 切换日期
    switchDate(date) {
      this.currentDate = date
      this.page = 1
      this.loadOrderList()
    },
    
    switchHallTab(key) {
      this.hallTab = key
      this.page = 1
      this.loadOrderList()
    },

    extractListPayload(res) {
      return res?.data?.订单列表 || res?.data?.data || res?.订单列表 || res?.data || []
    },

    mapOrderRow(o) {
      let goodsList = []
      try {
        let raw = o.products_info ?? o.items
        if (typeof raw === 'string') {
          raw = JSON.parse(raw)
        }
        const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
        goodsList = arr.map((g) => ({
          name: g.name || g.商品名称 || g.title || '',
          num: g.num || g.数量 || g.count || 1,
          price: g.price || g.价格 || g.amount || 0,
          spec: g.spec || g.规格 || '',
          image: g.image || g.img || ''
        }))
      } catch (e) {
        goodsList = []
      }

      const createdAt = o.createdAt || o.created_at
      const customerName = o.user?.nickname || o.contact_name || '顾客'
      const customerPhone = o.contact_phone || o.user?.phone || ''
      const rawAddress = o.delivery_address
      const address =
        typeof rawAddress === 'string'
          ? rawAddress
          : rawAddress
            ? JSON.stringify(rawAddress)
            : ''

      const pay = Number(o.pay_amount)
      const fee = Number(o.delivery_fee)
      let est = pay
      if (Number.isFinite(pay) && Number.isFinite(fee)) {
        est = pay - fee
      } else if (Number.isFinite(pay)) {
        est = pay
      } else {
        est = 0
      }

      return {
        id: o.id,
        orderNo: o.order_no || o.orderNo,
        status: o.status,
        statusText: ORDER_STATUS[o.status]?.text || '未知状态',
        createTime: createdAt ? formatTime(new Date(createdAt).getTime() / 1000, 'HH:mm') : '',
        customerName,
        customerPhone,
        address,
        goodsList,
        goodsAmount: o.total_amount,
        deliveryFee: o.delivery_fee,
        totalAmount: o.pay_amount,
        estimatedIncome: Number.isFinite(est) ? Number(est).toFixed(2) : '0.00',
        remark: o.remark || o.buyer_remark || '',
        orderType: o.order_type || o.orderType || '',
        isUrgent: false
      }
    },

    async loadOrderList() {
      try {
        const params = {
          page: this.page,
          page_size: this.pageSize
        }
        if (this.searchKey) {
          params.keyword = this.searchKey
        }
        if (this.currentDate) {
          params.date_range = this.currentDate
        }

        let list = []
        if (this.hallTab === '34') {
          const [r3, r4] = await Promise.all([
            getOrderList({ ...params, status: 3 }),
            getOrderList({ ...params, status: 4 })
          ])
          const a = this.extractListPayload(r3)
          const b = this.extractListPayload(r4)
          const byId = new Map()
          ;[...a, ...b].forEach((row) => {
            if (row && row.id != null && !byId.has(row.id)) {
              byId.set(row.id, row)
            }
          })
          list = Array.from(byId.values())
          list.sort((x, y) => {
            const tx = new Date(x.createdAt || x.created_at || 0).getTime()
            const ty = new Date(y.createdAt || y.created_at || 0).getTime()
            return ty - tx
          })
        } else {
          params.status = Number(this.hallTab)
          const res = await getOrderList(params)
          list = this.extractListPayload(res)
        }

        const mapped = list.map((o) => this.mapOrderRow(o))

        this.orderList = this.page > 1 ? [...this.orderList, ...mapped] : mapped
        await this.loadStats()
        this.noMore = mapped.length < this.pageSize
      } catch (e) {
        console.error('加载订单列表失败', e)
      }
    },
    
    // 下拉刷新
    async onRefresh() {
      this.refreshing = true
      this.page = 1
      await this.loadOrderList()
      this.refreshing = false
    },
    
    // 加载更多
    loadMore() {
      if (this.loadingMore || this.noMore) return
      this.loadingMore = true
      this.page++
      this.loadOrderList().then(() => {
        this.loadingMore = false
      })
    },
    
    async handleAccept(order) {
      try {
        await apiAcceptOrder(order.id, {
          merchant_lng: 115.681123,
          merchant_lat: 32.181234
        })
        uni.showToast({ title: '接单成功', icon: 'success' })
        this.page = 1
        await this.loadOrderList()
        await this.loadStats()
      } catch (e) {
        uni.showToast({ title: '接单失败', icon: 'none' })
      }
    },
    
    // 拒单（状态：1 待接单）
    rejectOrder(order) {
      uni.showModal({
        title: '拒单确认',
        content: '确定要拒绝此订单吗？',
        confirmText: '确定拒单',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            this.doReject(order)
          }
        }
      })
    },
    
    async doReject(order) {
      try {
        await rejectOrder(order.id, { reason: '商品已售罄' })
        uni.showToast({ title: '已拒单', icon: 'success' })
        this.loadOrderList()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    
    // 出餐完成：POST /api/order/prepare，状态 2 -> 3
    async finishMake(order) {
      try {
        await prepareOrder(order.id)
        uni.showToast({ title: '出餐完成', icon: 'success' })
        this.page = 1
        await this.loadOrderList()
        await this.loadStats()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    // 县城订单：POST /api/order/deliver（状态 3 或 4）
    async submitDeliver(order) {
      try {
        await deliverOrder(order.id)
        uni.showToast({ title: '已提交', icon: 'success' })
        this.page = 1
        await this.loadOrderList()
        await this.loadStats()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    
    // 打印订单
    printOrder(order) {
      uni.showToast({ title: '打印指令已发送', icon: 'none' })
      // TODO: 连接打印机
    },
    
    // 拨打电话
    callCustomer(phone) {
      uni.makePhoneCall({ phoneNumber: phone })
    },
    
    // 查看详情
    goDetail(id) {
      uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

/* 统计卡片 */
.stats-card {
  display: flex;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%);
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 32rpx 0;
}
.stats-item {
  flex: 1;
  text-align: center;
  color: #fff;
}
.stats-item:not(:last-child) {
  border-right: 1rpx solid rgba(255,255,255,0.3);
}
.stats-num {
  font-size: 40rpx;
  font-weight: 600;
  display: block;
}
.stats-label {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 8rpx;
  display: block;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #fff;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 32rpx;
  padding: 16rpx 24rpx;
}
.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}
.search-input-wrap input {
  flex: 1;
  font-size: 26rpx;
}
.clear-icon {
  font-size: 24rpx;
  color: #999;
  padding: 8rpx;
}
.filter-btn {
  margin-left: 20rpx;
  font-size: 26rpx;
  color: #666;
  display: flex;
  align-items: center;
}
.filter-icon {
  font-size: 20rpx;
  margin-left: 4rpx;
}

/* 日期筛选 */
.date-filter {
  display: flex;
  padding: 0 20rpx 20rpx;
  background: #fff;
}
.date-item {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #666;
  border-radius: 8rpx;
  margin-right: 16rpx;
}
.date-item.active {
  background: #FFF1F0;
  color: #FF6B35;
  font-weight: 500;
}

/* 订单大厅 Tab */
.hall-tabs {
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 16rpx 20rpx;
  gap: 16rpx;
}
.hall-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 12rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}
.hall-tab.active {
  background: #fff1f0;
  border: 2rpx solid #ff6b35;
}
.hall-tab-text {
  font-size: 26rpx;
  color: #666;
  font-weight: 500;
}
.hall-tab.active .hall-tab-text {
  color: #ff6b35;
}

/* 订单列表 */
.order-scroll {
  flex: 1;
  height: calc(100vh - 320rpx);
}
.order-list {
  padding: 20rpx;
}
.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.order-card.urgent {
  border-left: 6rpx solid #ff4d4f;
}

/* 订单头部 */
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.header-left {
  flex: 1;
}
.order-no {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
}
.order-time {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}
.status-tag {
  font-size: 26rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  font-weight: 500;
}
.status-1 { background: #FFF1F0; color: #FF6B35; }
.status-2 { background: #E6F7FF; color: #1890FF; }
.status-3 { background: #FFF7E6; color: #FAAD14; }
.status-4 { background: #F0F5FF; color: #2F54EB; }
.status-5 { background: #F6FFED; color: #52C41A; }
.status-6 { background: #F5F5F5; color: #999; }

/* 顾客信息 */
.customer-info {
  margin-bottom: 20rpx;
}
.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;
}
.label {
  font-size: 26rpx;
  color: #999;
  width: 100rpx;
  flex-shrink: 0;
}
.value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}
.value.address {
  line-height: 1.5;
}
.call-btn {
  font-size: 32rpx;
  padding: 0 16rpx;
}

/* 商品列表 */
.goods-list {
  background: #FAFAFA;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}
.goods-item {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.goods-item:last-child {
  margin-bottom: 0;
}
.goods-img {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
  margin-right: 16rpx;
  background: #f0f0f0;
}
.goods-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}
.goods-info {
  flex: 1;
}
.goods-name {
  font-size: 28rpx;
  color: #333;
  display: block;
}
.goods-spec {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}
.goods-price {
  text-align: right;
}
.goods-price .num {
  font-size: 24rpx;
  color: #999;
  display: block;
}
.goods-price .price {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  display: block;
  margin-top: 4rpx;
}
.more-goods {
  text-align: center;
  font-size: 24rpx;
  color: #999;
  padding-top: 12rpx;
  border-top: 1rpx dashed #e0e0e0;
  margin-top: 12rpx;
}

/* 订单金额 */
.order-amount {
  display: flex;
  align-items: center;
  justify-content: flex-end;
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
  font-size: 36rpx;
  color: #FF6B35;
  font-weight: 600;
}
.amount-detail {
  font-size: 22rpx;
  color: #999;
  margin-left: 16rpx;
}

/* 订单备注 */
.order-remark {
  display: flex;
  background: #FFFBE6;
  padding: 16rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}
.remark-label {
  font-size: 24rpx;
  color: #FAAD14;
  flex-shrink: 0;
}
.remark-content {
  flex: 1;
  font-size: 24rpx;
  color: #666;
  margin-left: 8rpx;
}

/* 操作按钮 */
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
  line-height: 1.5;
}
.btn-primary {
  background: #FF6B35;
  color: #fff;
}
.btn-danger {
  background: #fff;
  color: #ff4d4f;
  border: 1rpx solid #ff4d4f;
}
.btn-default {
  background: #f5f5f5;
  color: #666;
}

.status-hint {
  font-size: 26rpx;
  color: #52C41A;
  padding: 16rpx 32rpx;
}

/* 加载更多 */
.load-more, .no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #999;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}
.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
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

/* 筛选面板 */
.filter-panel {
  width: 600rpx;
  height: 100vh;
  background: #fff;
  padding: 40rpx;
}
.filter-title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 40rpx;
}
.filter-section {
  margin-bottom: 40rpx;
}
.section-title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.option-item {
  padding: 16rpx 32rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #666;
}
.option-item.active {
  background: #FFF1F0;
  color: #FF6B35;
}
.filter-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 40rpx;
  gap: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}
.filter-actions .btn {
  flex: 1;
}
</style>
