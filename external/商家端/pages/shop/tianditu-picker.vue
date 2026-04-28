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

const logPickerStep = (step, payload) => {
  try {
    console.log('[shop-tianditu-picker][' + step + ']', payload || '')
  } catch (e) {}
}

const normalizeCoordinateValue = (value) => {
  if (value == null) return null
  const raw = typeof value === 'string' ? value.trim() : value
  if (raw === '') return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

const getValidCoordinatePair = (latitude, longitude) => {
  const lat = normalizeCoordinateValue(latitude)
  const lng = normalizeCoordinateValue(longitude)
  if (lat == null || lng == null) return null
  if (lat === 0 && lng === 0) return null
  return {
    latitude: lat,
    longitude: lng
  }
}

const pickCoordinatePair = (source) => {
  if (!source || typeof source !== 'object') return null
  const deliveryAddress = source.delivery_address && typeof source.delivery_address === 'object' ? source.delivery_address : {}
  return getValidCoordinatePair(
    source.latitude != null
      ? source.latitude
      : (source.lat != null
        ? source.lat
        : (source.delivery_latitude != null ? source.delivery_latitude : deliveryAddress.latitude)),
    source.longitude != null
      ? source.longitude
      : (source.lng != null
        ? source.lng
        : (source.delivery_longitude != null ? source.delivery_longitude : deliveryAddress.longitude))
  )
}

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
    logPickerStep('onLoad-eventChannel', { hasEventChannel: !!this.eventChannel })
    const lat = options.lat != null && options.lat !== '' ? String(options.lat) : ''
    const lng = options.lng != null && options.lng !== '' ? String(options.lng) : ''
    const address = options.address != null && options.address !== '' ? String(options.address) : ''
    const tk = TIANDITU_TK || ''
    const q = [
      'tk=' + encodeURIComponent(tk),
      'lat=' + encodeURIComponent(lat),
      'lng=' + encodeURIComponent(lng),
      'address=' + encodeURIComponent(address)
    ].join('&')
    this.src = '/static/hybrid/html/tianditu-picker.html?' + q
    logPickerStep('onLoad-src-ready', { src: this.src })
  },
  methods: {
    normalizeResult(raw) {
      const source = raw || {}
      const deliveryAddress = source.delivery_address && typeof source.delivery_address === 'object' ? source.delivery_address : {}
      const coordinatePair = pickCoordinatePair(source)
      const address = String(source.address || deliveryAddress.detail || deliveryAddress.name || '').trim()
      const town = String(source.town || deliveryAddress.town || '').trim()
      return {
        latitude: coordinatePair ? coordinatePair.latitude : null,
        longitude: coordinatePair ? coordinatePair.longitude : null,
        address,
        town,
        delivery_address: {
          province: String(deliveryAddress.province || '').trim(),
          city: String(deliveryAddress.city || '').trim(),
          district: String(deliveryAddress.district || '').trim(),
          town,
          street: String(deliveryAddress.street || '').trim(),
          detail: String(deliveryAddress.detail || address || '').trim(),
          name: String(deliveryAddress.name || address || '').trim(),
          longitude: coordinatePair ? coordinatePair.longitude : null,
          latitude: coordinatePair ? coordinatePair.latitude : null
        }
      }
    },
    handlePicked(raw) {
      logPickerStep('handlePicked-enter', raw)
      const msg = this.normalizeResult(raw)
      logPickerStep('handlePicked-normalized', msg)
      if (msg == null || msg.latitude == null || msg.longitude == null) {
        uni.showToast({ title: '地图选点无效，请重新选点', icon: 'none' })
        return
      }
      const payload = {
        latitude: msg.latitude,
        longitude: msg.longitude
      }
      if (msg.address) {
        payload.address = msg.address
      }
      if (msg.town) {
        payload.town = msg.town
      }
      if (msg.delivery_address && typeof msg.delivery_address === 'object') {
        payload.delivery_address = msg.delivery_address
      }
      if (this.eventChannel) {
        logPickerStep('handlePicked-before-emit', payload)
        this.eventChannel.emit('picked', payload)
        logPickerStep('handlePicked-after-emit', { emitted: true })
      } else {
        logPickerStep('handlePicked-no-eventChannel', payload)
      }
      logPickerStep('handlePicked-before-navigateBack', payload)
      uni.navigateBack()
    },
    extractMessagePayload(e) {
      const raw = e && e.detail ? e.detail.data : null
      const candidates = []
      if (Array.isArray(raw)) {
        candidates.push(...raw)
      } else if (raw != null) {
        candidates.push(raw)
      }
      for (let i = candidates.length - 1; i >= 0; i -= 1) {
        const item = candidates[i]
        if (item && typeof item === 'object') {
          if (pickCoordinatePair(item)) return item
          if (item.data && typeof item.data === 'object') {
            const nested = item.data
            if (pickCoordinatePair(nested)) return nested
          }
        }
      }
      return null
    },
    onMessage(e) {
      logPickerStep('onMessage-enter', e && e.detail ? e.detail.data : e)
      const msg = this.extractMessagePayload(e)
      logPickerStep('onMessage-extracted', msg)
      if (msg == null) return
      this.handlePicked(msg)
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
