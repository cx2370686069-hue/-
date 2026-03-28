<template>
  <view class="container">
    <iframe v-if="isH5 && webViewSrc" ref="mapFrame" :src="webViewSrc" class="web-iframe"></iframe>
    <web-view v-else-if="webViewSrc" class="web-view" :src="webViewSrc"></web-view>
    <view v-else class="map-placeholder">
      <text class="placeholder-text">正在加载导航...</text>
    </view>
    <view class="action-bar">
      <button class="btn btn-primary" :class="{ active: stage === 'pickup' }" @click="handlePickup">去取餐</button>
      <button class="btn btn-primary" :class="{ active: stage === 'delivery' }" @click="handleDelivery">去送餐</button>
      <button v-if="isH5" class="btn btn-sim" @click="toggleSimulate">
        {{ simRunning ? '停止模拟' : '模拟送货' }}
      </button>
    </view>
  </view>
</template>

<script>
import { TIANDITU_TK } from '@/config/index.js'
import { io } from 'socket.io-client'

export default {
  data() {
    return {
      webViewSrc: '',
      riderId: '',
      token: '',
      stage: 'pickup',
      merchantLng: '',
      merchantLat: '',
      customerLng: '',
      customerLat: '',
      tk: '',
      simRunning: false,
      socket: null,
      watchId: null,
      trackingTimer: null,
      lastSent: { lng: null, lat: null, ts: 0 },
      fallbackPos: { lng: 115.66638, lat: 32.18385 },
      isDestroyed: false
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
    const {
      riderId,
      token,
      stage,
      merchantLng,
      merchantLat,
      customerLng,
      customerLat,
      destLng,
      destLat,
      tk
    } = options || {}

    this.riderId = riderId || 'rider-' + Date.now()
    this.token = token || ''
    this.stage = stage === 'delivery' ? 'delivery' : 'pickup'
    this.merchantLng = merchantLng || ''
    this.merchantLat = merchantLat || ''
    this.customerLng = customerLng || ''
    this.customerLat = customerLat || ''
    
    this.tk = uni.getStorageSync('tianditu_tk') || tk || TIANDITU_TK || ''

    if (!this.tk) {
      uni.showToast({ title: '请配置天地图TK', icon: 'none' })
    }

    const hasMerchant = this.merchantLng !== '' && this.merchantLat !== ''
    const hasCustomer = this.customerLng !== '' && this.customerLat !== ''
    const hasDest = destLng !== undefined && destLat !== undefined && destLng !== '' && destLat !== ''
    if (!hasMerchant && !hasCustomer && !hasDest) {
      uni.showToast({ title: '导航参数缺失', icon: 'none' })
      return
    }

    if (hasDest && !hasMerchant && !hasCustomer) {
      if (this.stage === 'delivery') {
        this.customerLng = String(destLng)
        this.customerLat = String(destLat)
      } else {
        this.merchantLng = String(destLng)
        this.merchantLat = String(destLat)
      }
    }

    this.initSocket()
    this.startLocationTracking()
    if (this.isH5) {
      window.addEventListener('message', this.onMapMessage)
    }
    await this.refreshRoute()
  },
  onUnload() {
    this.isDestroyed = true
    this.stopLocationTracking()
    this.destroySocket()
    if (this.isH5) {
      window.removeEventListener('message', this.onMapMessage)
    }
  },
  onHide() {
    this.stopLocationTracking()
  },
  onShow() {
    if (!this.isDestroyed) {
      this.startLocationTracking()
    }
  },
  methods: {
    onMapMessage(e) {
      const d = e && e.data ? e.data : null
      if (!d || d.type !== 'sim_location') {
        return
      }
      this.stopLocationTracking()
      console.log('收到模拟导航坐标:', d.lng, d.lat)
      const pos = {
        lng: d.lng,
        lat: d.lat,
        speed: d.speed || 30,
        heading: d.heading || 90,
        source: 'sim'
      }
      this.emitLocationForce(pos)
    },
    initSocket() {
      const SOCKET_URL = 'http://192.168.1.4:3000'
      console.log('开始初始化 Socket.io，目标地址:', SOCKET_URL)
      
      try {
    this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          auth: { 
            token: this.token,
            role: 'rider',
            userId: this.riderId
          },
          query: {
            role: 'rider',
            userId: this.riderId
          },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 10000
        })
        
        this.socket.on('connect', () => {
          console.log('✅ Socket 已成功连接到:', SOCKET_URL)
          console.log('Socket ID:', this.socket.id)
          console.log('当前角色: rider, userId:', this.riderId)
        })
        
        this.socket.on('connect_error', (err) => {
          console.error('❌ Socket 连接失败:', err.message)
          console.error('错误详情:', err)
        })
        
        this.socket.on('disconnect', (reason) => {
          console.warn('⚠️ Socket 已断开，原因:', reason)
        })
        
        this.socket.on('reconnect', (attemptNumber) => {
          console.log('🔄 Socket 重连成功，尝试次数:', attemptNumber)
        })
        
        this.socket.on('reconnect_error', (err) => {
          console.error('❌ Socket 重连失败:', err.message)
        })
        
        console.log('Socket.io 实例已创建:', this.socket ? '成功' : '失败')
      } catch (e) {
        console.error('❌ Socket 初始化异常:', e)
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
        if (this.isDestroyed) {
          this.stopLocationTracking()
          return
        }
        const pos = await this.getLocationWithFallback()
        if (this.isDestroyed) return
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
              console.log('✅ uni.getLocation 成功:', res.longitude, res.latitude)
              resolve({
                lng: res.longitude,
                lat: res.latitude,
                speed: res.speed || 0,
                heading: res.direction || 0,
                source: 'real'
              })
            },
            fail: (err) => {
              console.warn('⚠️ uni.getLocation 失败:', err)
              resolve(null)
            }
          })
        } catch (e) {
          console.warn('⚠️ uni.getLocation 异常:', e)
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
              console.log('✅ navigator.geolocation 成功:', p.coords.longitude, p.coords.latitude)
              resolve({
                lng: p.coords.longitude,
                lat: p.coords.latitude,
                speed: p.coords.speed || 0,
                heading: p.coords.heading || 0,
                source: 'real'
              })
            },
            (err) => {
              console.warn('⚠️ navigator.geolocation 失败:', err)
              resolve(null)
            },
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 }
          )
        } catch (e) {
          console.warn('⚠️ navigator.geolocation 异常:', e)
          resolve(null)
        }
      })
      if (navPos && navPos.lng && navPos.lat) {
        return navPos
      }

      console.warn('🔄 所有定位方式失败，使用固始县兜底坐标:', this.fallbackPos)
      uni.showToast({ title: '使用模拟测试坐标', icon: 'none' })
      
      return { 
        lng: this.fallbackPos.lng, 
        lat: this.fallbackPos.lat, 
        speed: 30, 
        heading: 90, 
        source: 'fallback'
      }
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
      if (this.isDestroyed) return
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
      this.doEmitLocation(lng, lat, pos)
    },
    emitLocationForce(pos) {
      if (this.isDestroyed) return
      if (!pos) {
        return
      }
      const lng = Number(pos.lng)
      const lat = Number(pos.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return
      }
      this.lastSent = { lng, lat, ts: Date.now() }
      this.doEmitLocation(lng, lat, pos)
    },
    doEmitLocation(lng, lat, pos) {
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
          vehicleId: this.riderId,
          position: [lng, lat],
          speed: pos.speed || 30,
          direction: pos.heading || 90,
          status: this.stage === 'delivery' ? 'delivering' : 'picking',
          timestamp: Date.now()
        }
        this.socket.emit('location_update', payload)
        console.log('✅ 坐标已上报:', lng.toFixed(6), lat.toFixed(6), 'vehicleId:', this.riderId)
      } catch (e) {
        console.error('坐标上报失败:', e)
      }
    },
    handlePickup() {
      if (this.stage === 'pickup') return
      this.stage = 'pickup'
      this.simRunning = false
      this.refreshRoute()
    },
    handleDelivery() {
      if (this.stage === 'delivery') return
      this.stage = 'delivery'
      this.simRunning = false
      this.refreshRoute()
    },
    getDestByStage() {
      if (this.stage === 'delivery') {
        return { lng: this.customerLng, lat: this.customerLat }
      }
      return { lng: this.merchantLng, lat: this.merchantLat }
    },
    async refreshRoute() {
      const dest = this.getDestByStage()
      const destLng = dest.lng === '' || dest.lng === undefined || dest.lng === null ? '' : String(dest.lng)
      const destLat = dest.lat === '' || dest.lat === undefined || dest.lat === null ? '' : String(dest.lat)
      if (!destLng || !destLat) {
        uni.showToast({ title: '目的地坐标缺失', icon: 'none' })
        return
      }

      const pos = await this.getLocationWithFallback()
      const timestamp = Date.now()
      const htmlPath = this.isH5 ? '/static/driver_map.html' : '/hybrid/html/driver_map.html'
      const url = `${htmlPath}?t=${timestamp}&stage=${encodeURIComponent(this.stage)}&tk=${encodeURIComponent(this.tk)}&startLng=${encodeURIComponent(String(pos.lng))}&startLat=${encodeURIComponent(String(pos.lat))}&destLng=${encodeURIComponent(destLng)}&destLat=${encodeURIComponent(destLat)}`
      this.webViewSrc = url
      this.emitLocation(pos)
    },
    async toggleSimulate() {
      const frame = this.$refs.mapFrame
      const win = frame && frame.contentWindow ? frame.contentWindow : null
      if (!win) {
        return
      }

      if (this.simRunning) {
        win.postMessage({ type: 'stop_sim' }, '*')
        this.simRunning = false
        this.startLocationTracking()
        return
      }

      this.stopLocationTracking()
      win.postMessage({ type: 'start_sim', intervalMs: 1500 }, '*')
      this.simRunning = true
    }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: #f7f7f7;
}

.web-iframe {
  width: 100%;
  height: calc(100vh - 120rpx);
  border: none;
}

.web-view {
  width: 100%;
  height: calc(100vh - 120rpx);
}

.map-placeholder {
  width: 100%;
  height: calc(100vh - 120rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f7f7;
}

.placeholder-text {
  color: #999;
  font-size: 28rpx;
}

.action-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background-color: rgba(255, 255, 255, 0.96);
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  height: 120rpx;
  box-sizing: border-box;
}

.btn {
  flex: 1;
  padding: 0;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
  opacity: 0.7;
}

.btn-primary.active {
  opacity: 1;
}

.btn-sim {
  flex: 0.8;
  background: #722ed1;
  color: #ffffff;
  opacity: 1;
}
</style>
