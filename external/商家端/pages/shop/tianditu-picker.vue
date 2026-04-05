<template>
  <view class="page">
    <web-view v-if="src" :src="src" @message="onMessage"></web-view>
    <view v-else class="fallback">
      <text class="fallback-text">正在加载天地图…</text>
    </view>
  </view>
</template>

<script>
import { TIANDITU_TK } from '@/config/index.js'

export default {
  data() {
    return {
      src: '',
      eventChannel: null
    }
  },
  onLoad(options) {
    try {
      this.eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel()
    } catch (e) {
      this.eventChannel = null
    }
    const lat = options.lat != null && options.lat !== '' ? String(options.lat) : '32.168'
    const lng = options.lng != null && options.lng !== '' ? String(options.lng) : '115.654'
    const tk = TIANDITU_TK || ''
    const q = [
      'tk=' + encodeURIComponent(tk),
      'lat=' + encodeURIComponent(lat),
      'lng=' + encodeURIComponent(lng)
    ].join('&')
    this.src = '/static/hybrid/html/tianditu-picker.html?' + q
  },
  methods: {
    onMessage(e) {
      const arr = e.detail.data || []
      const msg = arr[arr.length - 1]
      if (msg == null || msg.latitude == null || msg.longitude == null) return
      const payload = {
        latitude: Number(msg.latitude),
        longitude: Number(msg.longitude)
      }
      if (this.eventChannel) {
        this.eventChannel.emit('picked', payload)
      }
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.page {
  flex: 1;
  height: 100vh;
}
.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
.fallback-text {
  font-size: 28rpx;
  color: #999;
}
</style>
