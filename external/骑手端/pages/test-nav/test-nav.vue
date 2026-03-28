<template>
  <view class="page">
    <view class="actions">
      <view v-if="!tk" class="tk-row">
        <input v-model="tkInput" class="tk-input" placeholder="粘贴天地图 TK" />
        <button class="btn btn-save" @click="saveTk">保存</button>
      </view>
      <button class="btn btn-main" :disabled="loading" @click="createTestOrder">
        {{ loading ? '生成中...' : '生成测试订单并获取数据' }}
      </button>
      <view v-if="orderReady" class="row">
        <button class="btn btn-sub" :class="{ active: stage === 'pickup' }" @click="goPickup">去取餐</button>
        <button class="btn btn-sub" :class="{ active: stage === 'delivery' }" @click="goDelivery">去送餐</button>
      </view>
      <view v-if="orderReady && isH5" class="row">
        <button class="btn btn-sub btn-sim" @click="toggleSimulate">
          {{ simRunning ? '停止模拟' : '模拟骑手送货' }}
        </button>
      </view>
    </view>

    <view class="map-wrap">
      <iframe v-if="isH5 && webViewSrc" ref="mapFrame" :src="webViewSrc" class="web-iframe"></iframe>
      <web-view v-else-if="webViewSrc" class="web-view" :src="webViewSrc"></web-view>
      <view v-else class="map-placeholder">
        <text class="placeholder-text">等待生成订单后开始导航</text>
      </view>
    </view>
  </view>
</template>

<script>
import { TIANDITU_TK } from '@/config/index.js'
import { io } from 'socket.io-client'

export default {
  data() {
    return {
      loading: false,
      order: null,
      stage: 'pickup',
      webViewSrc: '',
      tk: '',
      tkInput: '',
      simRunning: false,
      socket: null,
      watchId: null,
      trackingTimer: null,
      lastSent: { lng: null, lat: null, ts: 0 },
      mockPos: { lng: 115.68233, lat: 32.18021 }
    }
  },
  computed: {
    isH5() {
      try {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
      } catch (e) {
        return false
      }
    },
    orderReady() {
      return !!(this.order && this.order.merchant_lng && this.order.merchant_lat && this.order.customer_lng && this.order.customer_lat)
    }
  },
  onLoad() {
    this.tk = uni.getStorageSync('tianditu_tk') || TIANDITU_TK || ''
    this.tkInput = this.tk
    this.initSocket()
    this.startLocationTracking()
    if (this.isH5) {
      window.addEventListener('message', this.onMapMessage)
    }
  },
  onUnload() {
    this.stopLocationTracking()
    this.destroySocket()
    if (this.isH5) {
      window.removeEventListener('message', this.onMapMessage)
    }
  },
  methods: {
    onMapMessage(e) {
      const d = e && e.data ? e.data : null
      if (!d || d.type !== 'sim_location') {
        return
      }
      const pos = {
        lng: d.lng,
        lat: d.lat,
        speed: d.speed || 8,
        heading: d.heading || 90,
        source: 'sim'
      }
      this.emitLocation(pos)
    },
    saveTk() {
      const v = String(this.tkInput || '').trim()
      if (!v) {
        uni.showToast({ title: '请输入天地图TK', icon: 'none' })
        return
      }
      this.tk = v
      uni.setStorageSync('tianditu_tk', v)
      uni.showToast({ title: 'TK 已保存', icon: 'success' })
    },
    async createTestOrder() {
      if (this.loading) {
        return
      }
      this.loading = true
      this.order = null
      try {
        const res = await new Promise((resolve, reject) => {
          uni.request({
            url: 'http://192.168.1.4:3000/api/orders/test-create',
            method: 'POST',
            data: {},
            timeout: 10000,
            success: resolve,
            fail: reject
          })
        })

        const body = res && res.data ? res.data : {}
        const data = body.data || body.order || body

        this.order = data || null
        if (!this.orderReady) {
          uni.showToast({ title: '订单坐标字段缺失', icon: 'none' })
        } else {
          uni.showToast({ title: '订单已生成', icon: 'success' })
          this.stage = 'pickup'
          await this.drawRouteByStage()
        }
      } catch (e) {
        uni.showToast({ title: '生成失败，请检查后端', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async goPickup() {
      if (!this.orderReady) {
        return
      }
      this.stage = 'pickup'
      await this.drawRouteByStage()
    },
    async goDelivery() {
      if (!this.orderReady) {
        return
      }
      this.stage = 'delivery'
      await this.drawRouteByStage()
    },
    async toggleSimulate() {
      if (!this.orderReady) {
        return
      }
      if (!this.webViewSrc) {
        this.stage = 'delivery'
        await this.drawRouteByStage()
        await new Promise((r) => setTimeout(r, 400))
      } else if (this.stage !== 'delivery') {
        this.stage = 'delivery'
        await this.drawRouteByStage()
        await new Promise((r) => setTimeout(r, 400))
      }

      const frame = this.$refs.mapFrame
      const win = frame && frame.contentWindow ? frame.contentWindow : null
      if (!win) {
        return
      }

      if (this.simRunning) {
        win.postMessage({ type: 'stop_sim' }, '*')
        this.simRunning = false
        return
      }

      win.postMessage({ type: 'start_sim', intervalMs: 1500 }, '*')
      this.simRunning = true
    },
    initSocket() {
      const SOCKET_URL = 'http://192.168.1.4:3000'
      try {
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: true
        })
        this.socket.on('connect', () => {
          console.log('Socket 已连接到:', SOCKET_URL)
        })
        this.socket.on('connect_error', (err) => {
          console.error('Socket 连接失败:', err.message)
        })
      } catch (e) {
        console.error('Socket 初始化失败:', e)
        this.socket = null
      }
    },
    destroySocket() {
      if (this.socket) {
        try {
          this.socket.disconnect()
        } catch (e) {}
      }
      this.socket = null
    },
    stopLocationTracking() {
      if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(this.watchId)
        } catch (e) {}
      }
      this.watchId = null
      if (this.trackingTimer) {
        clearInterval(this.trackingTimer)
      }
      this.trackingTimer = null
    },
    startLocationTracking() {
      this.stopLocationTracking()
      if (typeof navigator !== 'undefined' && navigator.geolocation && typeof navigator.geolocation.watchPosition === 'function') {
        try {
          this.watchId = navigator.geolocation.watchPosition(
            (p) => {
              const pos = {
                lng: p.coords.longitude,
                lat: p.coords.latitude,
                speed: p.coords.speed || 0,
                heading: p.coords.heading || 0,
                source: 'real'
              }
              this.emitLocation(pos)
            },
            () => {
              this.startPollingLocation()
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
          )
          return
        } catch (e) {}
      }
      this.startPollingLocation()
    },
    startPollingLocation() {
      if (this.trackingTimer) {
        clearInterval(this.trackingTimer)
      }
      this.trackingTimer = setInterval(async () => {
        const pos = await this.getLocationWithFallback()
        this.emitLocation(pos)
      }, 1000)
    },
    async getLocationWithFallback() {
      const uniPos = await new Promise((resolve) => {
        try {
          uni.getLocation({
            type: 'wgs84',
            isHighAccuracy: true,
            highAccuracyExpireTime: 3000,
            success: (res) => {
              resolve({
                lng: res.longitude,
                lat: res.latitude,
                speed: res.speed || 0,
                heading: res.direction || 0,
                source: 'real'
              })
            },
            fail: () => resolve(null)
          })
        } catch (e) {
          resolve(null)
        }
      })
      if (uniPos && uniPos.lng && uniPos.lat) {
        return uniPos
      }

      const navPos = await new Promise((resolve) => {
        try {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve(null)
            return
          }
          navigator.geolocation.getCurrentPosition(
            (p) => {
              resolve({
                lng: p.coords.longitude,
                lat: p.coords.latitude,
                speed: p.coords.speed || 0,
                heading: p.coords.heading || 0,
                source: 'real'
              })
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 }
          )
        } catch (e) {
          resolve(null)
        }
      })
      if (navPos && navPos.lng && navPos.lat) {
        return navPos
      }

      this.mockPos = {
        lng: Number(this.mockPos.lng) + 0.00002,
        lat: Number(this.mockPos.lat) + 0.00001
      }
      return { lng: this.mockPos.lng, lat: this.mockPos.lat, speed: 8, heading: 90, source: 'mock' }
    },
    shouldSend(lng, lat) {
      const now = Date.now()
      const last = this.lastSent || {}
      if (!last.ts) {
        return true
      }
      if (now - last.ts < 800) {
        return false
      }
      if (last.lng === null || last.lat === null) {
        return true
      }
      const dlng = Math.abs(Number(lng) - Number(last.lng))
      const dlat = Math.abs(Number(lat) - Number(last.lat))
      return dlng + dlat > 0.000005
    },
    emitLocation(pos) {
      if (!pos) {
        return
      }
      const lng = Number(pos.lng)
      const lat = Number(pos.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return
      }
      if (!this.shouldSend(lng, lat)) {
        return
      }
      this.lastSent = { lng, lat, ts: Date.now() }
      if (!this.socket) {
        console.warn('Socket 未初始化，无法上报坐标')
        return
      }
      if (!this.socket.connected) {
        console.warn('Socket 未连接，尝试重连...')
        this.socket.connect()
      }
      try {
        const payload = {
          type: 'location_update',
          vehicleId: 'test-rider',
          position: [lng, lat],
          speed: pos.speed || 30,
          direction: pos.heading || 90,
          status: this.stage === 'delivery' ? 'delivering' : 'picking',
          timestamp: Date.now()
        }
        this.socket.emit('location_update', payload)
        console.log('坐标已上报:', lng, lat, 'vehicleId: test-rider')
      } catch (e) {
        console.error('坐标上报失败:', e)
      }
    },
    getDestByStage() {
      if (this.stage === 'delivery') {
        return { lng: this.order.customer_lng, lat: this.order.customer_lat }
      }
      return { lng: this.order.merchant_lng, lat: this.order.merchant_lat }
    },
    async drawRouteByStage() {
      const tk = this.tk || ''
      if (!tk) {
        uni.showToast({ title: '请先填写天地图TK', icon: 'none' })
        return
      }
      const dest = this.getDestByStage()
      const destLng = dest && dest.lng !== undefined && dest.lng !== null && dest.lng !== '' ? String(dest.lng) : ''
      const destLat = dest && dest.lat !== undefined && dest.lat !== null && dest.lat !== '' ? String(dest.lat) : ''
      if (!destLng || !destLat) {
        uni.showToast({ title: '目的地坐标缺失', icon: 'none' })
        return
      }

      const pos = await this.getLocationWithFallback()
      const htmlPath = this.isH5 ? '/static/driver_map.html' : '/hybrid/html/driver_map.html'
      const timestamp = Date.now()
      this.webViewSrc = `${htmlPath}?t=${timestamp}&stage=${encodeURIComponent(this.stage)}&tk=${encodeURIComponent(tk)}&startLng=${encodeURIComponent(String(pos.lng))}&startLat=${encodeURIComponent(String(pos.lat))}&destLng=${encodeURIComponent(destLng)}&destLat=${encodeURIComponent(destLat)}`
      this.emitLocation(pos)
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  box-sizing: border-box;
}

.actions {
  padding: 24rpx;
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.tk-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.tk-input {
  flex: 1;
  height: 72rpx;
  padding: 0 18rpx;
  border-radius: 12rpx;
  background: #f7f7f7;
  font-size: 26rpx;
}

.row {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
}

.btn {
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 22rpx 18rpx;
}

.btn-main {
  width: 100%;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #ffffff;
}

.btn-save {
  width: 160rpx;
  background: #52c41a;
  color: #ffffff;
}

.btn-sim {
  flex: 1;
  background: #722ed1;
  color: #ffffff;
  opacity: 1;
}

.btn-sub {
  flex: 1;
  background: #1890ff;
  color: #ffffff;
}

.map-wrap {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
}

.web-iframe {
  width: 100%;
  height: calc(100vh - 320rpx);
  border: none;
}

.web-view {
  width: 100%;
  height: calc(100vh - 320rpx);
}

.map-placeholder {
  width: 100%;
  height: calc(100vh - 320rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f7f7;
}

.placeholder-text {
  color: #999;
  font-size: 26rpx;
}

.btn-sub {
  opacity: 0.7;
}

.btn-sub.active {
  opacity: 1;
}
</style>

