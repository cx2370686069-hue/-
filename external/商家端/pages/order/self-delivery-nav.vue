<template>
  <view class="page">
    <iframe v-if="isH5 && webViewSrc" :src="webViewSrc" class="map-frame"></iframe>
    <web-view v-else-if="webViewSrc" :src="webViewSrc" class="map-webview"></web-view>
    <view v-else class="loading-box">
      <text class="loading-text">正在加载天地图路线...</text>
    </view>
    <view class="info-bar">
      <view class="info-main">
        <text class="info-title">老板自配送导航</text>
        <text class="info-address">{{ addressText }}</text>
      </view>
      <button class="info-btn" @click="reloadRoute">重新定位</button>
      <button v-if="phone" class="info-btn info-btn-call" @click="callCustomer">联系顾客</button>
    </view>
  </view>
</template>

<script>
import { TIANDITU_TK } from '@/config/index.js'

const toCoordinateNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const getValidCoordinatePair = (longitude, latitude) => {
  const lng = toCoordinateNumber(longitude)
  const lat = toCoordinateNumber(latitude)
  if (lng == null || lat == null) return null
  if (lng === 0 && lat === 0) return null
  return { lng, lat }
}

export default {
  data() {
    return {
      webViewSrc: '',
      webViewDebugPath: '',
      customerLng: null,
      customerLat: null,
      merchantLng: null,
      merchantLat: null,
      addressText: '',
      phone: '',
      tk: ''
    }
  },
  computed: {
    isH5() {
      try {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
      } catch (e) {
        return false
      }
    }
  },
  async onLoad(options) {
    const customerPair = getValidCoordinatePair(options.customerLng, options.customerLat)
    const merchantPair = getValidCoordinatePair(options.merchantLng, options.merchantLat)
    this.customerLng = customerPair ? customerPair.lng : null
    this.customerLat = customerPair ? customerPair.lat : null
    this.merchantLng = merchantPair ? merchantPair.lng : null
    this.merchantLat = merchantPair ? merchantPair.lat : null
    this.addressText = String(options.address || '').trim()
    this.phone = String(options.phone || '').trim()
    this.tk = uni.getStorageSync('tianditu_tk') || TIANDITU_TK || ''

    if (this.customerLng == null || this.customerLat == null) {
      uni.showToast({ title: '订单缺少收货坐标，无法打开地图', icon: 'none' })
      return
    }
    if (!this.tk) {
      uni.showToast({ title: '缺少天地图TK', icon: 'none' })
      return
    }
    await this.reloadRoute()
  },
  methods: {
    async resolveStartPosition() {
      try {
        const location = await new Promise((resolve, reject) => {
          uni.getLocation({
            type: 'wgs84',
            isHighAccuracy: true,
            highAccuracyExpireTime: 3000,
            success: resolve,
            fail: reject
          })
        })
        const currentPair = getValidCoordinatePair(location && location.longitude, location && location.latitude)
        if (currentPair) {
          return currentPair
        }
      } catch (e) {}
      const merchantPair = getValidCoordinatePair(this.merchantLng, this.merchantLat)
      if (merchantPair) {
        return merchantPair
      }
      return null
    },
    async reloadRoute() {
      const start = await this.resolveStartPosition()
      if (!start) {
        uni.showToast({ title: '无法获取商家定位，无法规划路线', icon: 'none' })
        return
      }
      const htmlPath = this.isH5 ? '/static/merchant_delivery_map.html' : '/hybrid/html/merchant_delivery_map.html'
      const query = [
        'stage=delivery',
        'mapVersion=NEW-MAP-V1',
        `tk=${encodeURIComponent(this.tk)}`,
        `startLng=${encodeURIComponent(String(start.lng))}`,
        `startLat=${encodeURIComponent(String(start.lat))}`,
        `destLng=${encodeURIComponent(String(this.customerLng))}`,
        `destLat=${encodeURIComponent(String(this.customerLat))}`,
        `t=${Date.now()}`
      ].join('&')
      this.webViewSrc = `${htmlPath}?${query}`
      this.webViewDebugPath = this.webViewSrc
      console.log('[merchant-map-src]', this.webViewSrc)
    },
    callCustomer() {
      if (!this.phone) {
        uni.showToast({ title: '顾客电话缺失', icon: 'none' })
        return
      }
      uni.makePhoneCall({ phoneNumber: this.phone })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f7f7;
}

.map-frame,
.map-webview {
  width: 100%;
  height: calc(100vh - 144rpx);
  border: none;
}

.loading-box {
  height: calc(100vh - 144rpx);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

.info-bar {
  height: 144rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #ffffff;
  box-sizing: border-box;
  border-top: 1rpx solid #f0f0f0;
}

.info-main {
  flex: 1;
  min-width: 0;
}

.info-title {
  display: block;
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}

.info-address {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 24rpx;
  border: none;
  border-radius: 36rpx;
  background: #ff6b35;
  color: #fff;
  font-size: 24rpx;
}

.info-btn-call {
  background: #52c41a;
}
</style>
