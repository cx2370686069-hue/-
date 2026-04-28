<template>
  <view class="container">
    <view class="card">
      <text class="section-title">订单信息</text>
      <view class="scope-banner" :class="{ 'town-banner': isTownOrder(order) }">
        {{ isTownOrder(order) ? `乡镇配送｜${getTownName(order) || '未标注乡镇'}` : '县城配送' }}
      </view>
      <view class="info-row">
        <text class="label">订单号</text>
        <text class="value">{{ order.order_no }}</text>
      </view>
      <view class="info-row">
        <text class="label">订单状态</text>
        <text class="value status" :style="{ color: getStatusColor(order.status) }">
          {{ getStatusText(order.status) }}
        </text>
      </view>
      <view class="info-row">
        <text class="label">下单时间</text>
        <text class="value">{{ formatTime(order.created_at) }}</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">配送信息</text>
      <view class="info-row">
        <text class="label">商家名称</text>
        <text class="value">{{ order.merchant?.name || '未知商家' }}</text>
      </view>
      <view class="info-row">
        <text class="label">配送地址</text>
        <text class="value">{{ getFullAddress(order) }}</text>
      </view>
      <view class="info-row" v-if="getTownName(order)">
        <text class="label">所属乡镇</text>
        <text class="value">{{ getTownName(order) }}</text>
      </view>
      <view class="info-row">
        <text class="label">联系人</text>
        <text class="value">{{ order.contact_name }}</text>
      </view>
      <view class="info-row">
        <text class="label">联系电话</text>
        <text class="value" @click="callUser(order.contact_phone)">{{ order.contact_phone }}</text>
      </view>
      <view class="info-row">
        <text class="label">商家坐标</text>
        <text class="value">{{ formatCoordinate(getMerchantCoords()) }}</text>
      </view>
      <view class="info-row">
        <text class="label">用户坐标</text>
        <text class="value">{{ formatCoordinate(getCustomerCoords()) }}</text>
      </view>
    </view>

    <view class="card">
      <text class="section-title">费用信息</text>
      <view class="info-row">
        <text class="label">订单总额</text>
        <text class="value">¥{{ order.pay_amount }}</text>
      </view>
      <view class="info-row">
        <text class="label">配送费</text>
        <text class="value highlight">¥{{ order.rider_fee }}</text>
      </view>
    </view>

    <view class="action-bar">
      <button
        v-if="canPickup(order.status)"
        class="btn btn-primary"
        @click="handlePickup"
      >
        取餐并开始配送
      </button>
      <button class="btn btn-primary" @click="goPickup">
        去取餐
      </button>
      <button class="btn btn-primary" @click="goDelivery">
        去送餐
      </button>
      <button
        v-if="canRiderShowConfirmDelivery(order.status)"
        class="btn btn-success"
        @click="handleConfirmDeliveryAction"
      >
        确认送达
      </button>
    </view>
  </view>
</template>

<script>
import { getOrderDetail, riderPickup, confirmDelivery, confirmDeliverySpecial } from '@/api/order.js'
import {
  ORDER_STATUS,
  TIANDITU_TK,
  canRiderShowConfirmDelivery,
  canRiderCallConfirmDeliveryApi,
  canRiderOfferSpecialComplete
} from '@/config/index.js'
import { formatTime } from '@/utils/index.js'

export default {
  data() {
    return {
      orderId: null,
      order: {}
    }
  },
  onLoad(options) {
    this.orderId = options.id
    this.loadOrderDetail()
  },
  onShow() {
    if (this.orderId) {
      this.loadOrderDetail()
    }
  },
  methods: {
    formatTime,
    canRiderShowConfirmDelivery,
    canRiderCallConfirmDeliveryApi,
    canRiderOfferSpecialComplete,
    getStatusText(status) {
      return ORDER_STATUS[status]?.text || '未知'
    },
    getStatusColor(status) {
      if (this.isTownOrder(this.order)) {
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
    async loadOrderDetail() {
      try {
        const res = await getOrderDetail(this.orderId)
        this.order = res.data || {}
      } catch (e) {
        console.error('加载订单详情失败', e)
      }
    },
    handleConfirmDeliveryAction() {
      const st = Number(this.order.status)
      if (canRiderCallConfirmDeliveryApi(st)) {
        uni.showModal({
          title: '确认送达',
          content: '确认订单已送达？',
          confirmText: '确认送达',
          cancelText: '取消',
          success: async (res) => {
            if (!res.confirm) return
            if (!canRiderCallConfirmDeliveryApi(this.order.status)) {
              uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
              return
            }
            try {
              await confirmDelivery(this.orderId)
              uni.showToast({ title: '送达成功', icon: 'success' })
              await this.loadOrderDetail()
            } catch (e) {
              console.error('确认送达失败', e)
            }
          }
        })
        return
      }
      if (canRiderOfferSpecialComplete(st)) {
        uni.showModal({
          title: '确认送达',
          content: '当前订单未进入配送中，将按特殊完结处理，确认继续？',
          confirmText: '确认送达',
          cancelText: '取消',
          success: async (res) => {
            if (!res.confirm) return
            if (!canRiderOfferSpecialComplete(this.order.status)) {
              uni.showToast({ title: '订单状态已变更，请刷新后重试', icon: 'none' })
              return
            }
            try {
              await confirmDeliverySpecial(this.orderId)
              uni.showToast({ title: '操作成功', icon: 'success' })
              await this.loadOrderDetail()
            } catch (e) {
              console.error('特殊完结失败', e)
            }
          }
        })
        return
      }
      uni.showToast({
        title: '当前订单无法确认送达',
        icon: 'none',
        duration: 2500
      })
    },
    getRiderId() {
      const userInfoStr = uni.getStorageSync('userInfo')
      if (!userInfoStr) {
        return ''
      }
      try {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.id || ''
      } catch (e) {
        console.error('解析用户信息失败', e)
        return ''
      }
    },
    parseAddress() {
      try {
        return typeof this.order.delivery_address === 'string'
          ? JSON.parse(this.order.delivery_address)
          : (this.order.delivery_address || {})
      } catch (e) {
        return {}
      }
    },
    getCoordinateByKeys(source, keys) {
      for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
      return ''
    },
    getMerchantCoords() {
      const address = this.parseAddress()
      const merchant = this.order.merchant || {}
      const lng = this.getCoordinateByKeys(merchant, ['lng', 'lat_lng', 'longitude', 'lon', 'map_lng', 'merchant_lng', 'merchantLng'])
        || this.getCoordinateByKeys(this.order || {}, ['merchant_lng', 'merchantLng', 'shop_lng', 'shopLng', 'store_lng', 'storeLng', 'pickup_lng', 'pickupLng', 'from_lng', 'fromLng'])
        || this.getCoordinateByKeys(address, ['merchant_lng', 'shop_lng', 'store_lng', 'pickup_lng', 'from_lng'])
      const lat = this.getCoordinateByKeys(merchant, ['lat', 'latitude', 'map_lat', 'merchant_lat', 'merchantLat'])
        || this.getCoordinateByKeys(this.order || {}, ['merchant_lat', 'merchantLat', 'shop_lat', 'shopLat', 'store_lat', 'storeLat', 'pickup_lat', 'pickupLat', 'from_lat', 'fromLat'])
        || this.getCoordinateByKeys(address, ['merchant_lat', 'shop_lat', 'store_lat', 'pickup_lat', 'from_lat'])
      return { lng, lat }
    },
    getCustomerCoords() {
      const address = this.parseAddress()
      const fallback = this.order || {}
      const lng = this.getCoordinateByKeys(address, ['lng', 'longitude', 'lon', 'map_lng', 'delivery_lng', 'deliveryLng', 'user_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customer_lng', 'customerLng'])
        || this.getCoordinateByKeys(fallback, ['delivery_lng', 'deliveryLng', 'delivery_longitude', 'user_lng', 'userLng', 'contact_lng', 'receiver_lng', 'to_lng', 'dest_lng', 'customer_lng', 'customerLng'])
      const lat = this.getCoordinateByKeys(address, ['lat', 'latitude', 'map_lat', 'delivery_lat', 'deliveryLat', 'user_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customer_lat', 'customerLat'])
        || this.getCoordinateByKeys(fallback, ['delivery_lat', 'deliveryLat', 'delivery_latitude', 'user_lat', 'userLat', 'contact_lat', 'receiver_lat', 'to_lat', 'dest_lat', 'customer_lat', 'customerLat'])
      return { lng, lat }
    },
    navigateToMap(payload) {
      const riderId = this.getRiderId() || this.getCoordinateByKeys(this.order || {}, ['rider_id', 'riderId', 'user_id', 'userId']) || 'test-rider'
      const token = uni.getStorageSync('token') || ''
      const stage = payload && payload.stage === 'delivery' ? 'delivery' : 'pickup'
      const safeTk = TIANDITU_TK || ''
      const safeMerchantLng = payload && payload.merchantLng !== undefined && payload.merchantLng !== null && payload.merchantLng !== '' ? String(payload.merchantLng) : ''
      const safeMerchantLat = payload && payload.merchantLat !== undefined && payload.merchantLat !== null && payload.merchantLat !== '' ? String(payload.merchantLat) : ''
      const safeCustomerLng = payload && payload.customerLng !== undefined && payload.customerLng !== null && payload.customerLng !== '' ? String(payload.customerLng) : ''
      const safeCustomerLat = payload && payload.customerLat !== undefined && payload.customerLat !== null && payload.customerLat !== '' ? String(payload.customerLat) : ''
      uni.navigateTo({
        url: `/pages/map/nav?riderId=${encodeURIComponent(riderId)}&token=${encodeURIComponent(token)}&stage=${encodeURIComponent(stage)}&tk=${encodeURIComponent(safeTk)}&merchantLng=${encodeURIComponent(safeMerchantLng)}&merchantLat=${encodeURIComponent(safeMerchantLat)}&customerLng=${encodeURIComponent(safeCustomerLng)}&customerLat=${encodeURIComponent(safeCustomerLat)}`
      })
    },
    goPickup() {
      const merchant = this.getMerchantCoords()
      const customer = this.getCustomerCoords()
      this.navigateToMap({
        stage: 'pickup',
        merchantLng: merchant.lng,
        merchantLat: merchant.lat,
        customerLng: customer.lng,
        customerLat: customer.lat
      })
    },
    goDelivery() {
      const merchant = this.getMerchantCoords()
      const customer = this.getCustomerCoords()
      this.navigateToMap({
        stage: 'delivery',
        merchantLng: merchant.lng,
        merchantLat: merchant.lat,
        customerLng: customer.lng,
        customerLat: customer.lat
      })
    },
    callUser(phone) {
      if (phone) {
        uni.makePhoneCall({ phoneNumber: phone })
      }
    },
    formatCoordinate(coords = {}) {
      if (coords.lng === '' || coords.lat === '') {
        return '未提供坐标'
      }
      return `${coords.lng}, ${coords.lat}`
    },
    async handlePickup() {
      if (!this.canPickup(this.order.status)) {
        uni.showToast({ title: '当前订单不可取餐', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认取餐',
        content: '确认已取餐并开始配送？',
        confirmText: '开始配送',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await riderPickup(this.orderId)
            uni.showToast({ title: '已开始配送', icon: 'success' })
            await this.loadOrderDetail()
          } catch (e) {
            console.error('取餐失败', e)
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20rpx;
}

.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.scope-banner {
  margin-bottom: 20rpx;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.scope-banner.town-banner {
  background: rgba(31, 111, 67, 0.12);
  color: #1f6f43;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 26rpx;
  color: #999;
}

.value {
  font-size: 26rpx;
  color: #333;
  max-width: 60%;
}

.value.status {
  font-weight: 500;
}

.value.highlight {
  color: #FF6B35;
  font-weight: bold;
  font-size: 30rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 20rpx;
  background-color: #fff;
  border-top: 1rpx solid #f0f0f0;
  gap: 20rpx;
}

.btn {
  flex: 1;
  padding: 24rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
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
</style>
