<template>
  <scroll-view scroll-y class="page" :show-scrollbar="false">
    <view class="hero">
      <view class="avatar" @click="previewLogo">
        <image v-if="logoDisplay" class="avatar-img" :src="logoDisplay" mode="aspectFill" />
        <text v-else class="avatar-text">{{ form.name ? form.name.slice(0, 1) : '店' }}</text>
      </view>
      <text class="hero-title">{{ form.name || '店铺基础设置' }}</text>
      <text class="hero-sub">坐标仅通过天地图选取，未使用高德/百度</text>
    </view>

    <view class="card">
      <view class="card-title">基本信息</view>

      <view class="cell">
        <text class="label">店名</text>
        <input
          class="input"
          v-model="form.name"
          placeholder="请输入店铺名称"
          placeholder-class="ph"
        />
      </view>

      <view class="cell">
        <text class="label">联系电话</text>
        <input
          class="input"
          v-model="form.phone"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="ph"
        />
      </view>

      <view class="cell column">
        <text class="label">店铺描述</text>
        <textarea
          class="textarea"
          v-model="form.description"
          placeholder="简介、特色等（选填）"
          placeholder-class="ph"
          maxlength="500"
        />
      </view>

      <view class="cell column">
        <text class="label">Logo 地址</text>
        <input
          class="input"
          v-model="form.logo"
          placeholder="https:// 开头的图片 URL（选填）"
          placeholder-class="ph"
        />
        <view class="logo-actions">
          <text class="link" @click="chooseLogoImage">从相册选择图片（仅本地预览，提交需可访问 URL）</text>
        </view>
      </view>

      <view class="cell column">
        <text class="label">详细地址</text>
        <textarea
          class="textarea sm"
          v-model="form.address"
          placeholder="门牌、楼层等"
          placeholder-class="ph"
        />
      </view>
    </view>

    <view class="card">
      <view class="card-title">营业与配送</view>

      <view class="cell switch-row">
        <view class="switch-label">
          <text class="label">营业状态</text>
          <text class="hint">{{ form.status === 1 ? '营业中' : '休息中' }}</text>
        </view>
        <switch :checked="form.status === 1" color="#FF6B35" @change="onStatusChange" />
      </view>

      <view class="cell">
        <text class="label">配送半径(km)</text>
        <input
          class="input"
          v-model.number="form.delivery_radius"
          type="digit"
          placeholder="如 3"
          placeholder-class="ph"
        />
      </view>
    </view>

    <view class="card">
      <view class="card-title">地图位置（天地图）</view>

      <view class="cell column">
        <text class="label">当前坐标</text>
        <text class="coord" v-if="hasCoords">
          纬度 {{ formatCoord(form.latitude) }}，经度 {{ formatCoord(form.longitude) }}
        </text>
        <text class="coord empty" v-else>尚未在地图上选点</text>
        <button class="map-btn" type="default" @click="openTiandituPicker">
          在地图上选择店铺位置
        </button>
        <text class="map-tip">使用国家天地图选点，自动写入 latitude / longitude</text>
      </view>
    </view>

    <view class="footer-space" />
    <view class="footer">
      <button class="submit" :loading="submitting" @click="submitForm">
        {{ isCreateMode ? '创建店铺' : '保存设置' }}
      </button>
    </view>
  </scroll-view>
</template>

<script>
import { getShopInfo, createShop, updateShopInfo } from '@/api/shop.js'
import { TIANDITU_TK } from '@/config/index.js'

const DEFAULT_FORM = () => ({
  name: '',
  phone: '',
  description: '',
  logo: '',
  address: '',
  latitude: null,
  longitude: null,
  status: 1,
  delivery_radius: 3
})

export default {
  data() {
    return {
      isCreateMode: false,
      submitting: false,
      logoLocal: '',
      form: DEFAULT_FORM()
    }
  },
  computed: {
    logoDisplay() {
      if (this.logoLocal) return this.logoLocal
      const u = this.form.logo
      if (u && /^https?:\/\//i.test(u)) return u
      return ''
    },
    hasCoords() {
      return this.form.latitude != null && this.form.longitude != null && !Number.isNaN(Number(this.form.latitude)) && !Number.isNaN(Number(this.form.longitude))
    }
  },
  onLoad() {
    this.loadShopData()
  },
  methods: {
    formatCoord(v) {
      if (v == null || v === '') return '-'
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(6) : String(v)
    },
    normalizeMerchant(raw) {
      if (!raw || typeof raw !== 'object') return null
      const m = raw.merchant && typeof raw.merchant === 'object' ? raw.merchant : raw
      const lat = m.latitude
      const lng = m.longitude
      return {
        name: m.name != null ? String(m.name) : '',
        phone: m.phone != null ? String(m.phone) : '',
        description: m.description != null ? String(m.description) : '',
        logo: m.logo != null ? String(m.logo) : '',
        address: m.address != null ? String(m.address) : '',
        latitude: lat === '' || lat == null ? null : Number(lat),
        longitude: lng === '' || lng == null ? null : Number(lng),
        status: m.status === 0 ? 0 : 1,
        delivery_radius: m.delivery_radius != null && m.delivery_radius !== '' ? Number(m.delivery_radius) : 3
      }
    },
    async loadShopData() {
      try {
        const res = await getShopInfo()
        const raw = res && typeof res === 'object' && 'data' in res ? res.data : res
        const merchant = this.normalizeMerchant(raw)
        const id = raw && raw.id != null ? raw.id : merchant && raw && raw.merchant && raw.merchant.id
        const hasShop = !!(merchant && (merchant.name || id != null))
        if (hasShop) {
          this.isCreateMode = false
          this.form = { ...DEFAULT_FORM(), ...merchant }
        } else {
          this.isCreateMode = true
          this.form = DEFAULT_FORM()
        }
      } catch (e) {
        console.log('未获取到店铺或接口异常，进入创建模式', e)
        this.isCreateMode = true
        this.form = DEFAULT_FORM()
      }
    },
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0
    },
    previewLogo() {
      if (!this.logoDisplay) return
      uni.previewImage({ urls: [this.logoDisplay] })
    },
    chooseLogoImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = res.tempFilePaths && res.tempFilePaths[0]
          if (path) this.logoLocal = path
        }
      })
    },
    openTiandituPicker() {
      if (!TIANDITU_TK) {
        uni.showModal({
          title: '缺少天地图密钥',
          content: '请在 config/index.js 中填写 TIANDITU_TK（浏览器端密钥），保存后重新编译运行。',
          showCancel: false
        })
        return
      }
      const lat = this.form.latitude != null ? String(this.form.latitude) : ''
      const lng = this.form.longitude != null ? String(this.form.longitude) : ''
      uni.navigateTo({
        url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        events: {
          picked: (data) => {
            if (!data) return
            this.form.latitude = data.latitude
            this.form.longitude = data.longitude
          }
        }
      })
    },
    buildPayload() {
      const logo = (this.form.logo || '').trim()
      const payload = {
        name: (this.form.name || '').trim(),
        phone: (this.form.phone || '').trim(),
        description: (this.form.description || '').trim(),
        address: (this.form.address || '').trim(),
        status: this.form.status,
        delivery_radius: Number(this.form.delivery_radius) || 0
      }
      if (logo && /^https?:\/\//i.test(logo)) {
        payload.logo = logo
      }
      if (this.hasCoords) {
        payload.latitude = Number(this.form.latitude)
        payload.longitude = Number(this.form.longitude)
      }
      return payload
    },
    async submitForm() {
      const p = this.buildPayload()
      if (!p.name) {
        uni.showToast({ title: '请填写店名', icon: 'none' })
        return
      }
      if (!p.phone) {
        uni.showToast({ title: '请填写联系电话', icon: 'none' })
        return
      }
      if (!p.address) {
        uni.showToast({ title: '请填写详细地址', icon: 'none' })
        return
      }
      if (!this.hasCoords) {
        uni.showToast({ title: '请通过天地图选择店铺坐标', icon: 'none' })
        return
      }

      this.submitting = true
      try {
        if (this.isCreateMode) {
          const res = await createShop(p)
          if (res && (res.code === 200 || res.code === 201 || res.success)) {
            uni.showToast({ title: '创建成功', icon: 'success' })
            this.isCreateMode = false
            await this.loadShopData()
          } else {
            uni.showToast({ title: (res && res.message) || '创建失败', icon: 'none' })
          }
        } else {
          const res = await updateShopInfo(p)
          if (res && (res.code === 200 || res.success)) {
            uni.showToast({ title: '保存成功', icon: 'success' })
            await this.loadShopData()
          } else {
            uni.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
          }
        }
      } catch (e) {
        uni.showToast({ title: '网络异常', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.page {
  height: 100vh;
  background: #f5f5f5;
  box-sizing: border-box;
}
.hero {
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  padding: 40rpx 32rpx 48rpx;
  color: #fff;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 20rpx;
}
.avatar-img {
  width: 100%;
  height: 100%;
}
.avatar-text {
  font-size: 48rpx;
  font-weight: 700;
  color: #ff6b35;
}
.hero-title {
  font-size: 36rpx;
  font-weight: 600;
  display: block;
}
.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  opacity: 0.9;
}
.card {
  margin: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx 0 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}
.card-title {
  padding: 24rpx 28rpx 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}
.cell {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #f2f2f2;
}
.cell:last-child {
  border-bottom: none;
}
.cell.column {
  flex-direction: column;
  align-items: stretch;
}
.label {
  width: 200rpx;
  font-size: 28rpx;
  color: #333;
  flex-shrink: 0;
}
.cell.column .label {
  width: 100%;
  margin-bottom: 12rpx;
}
.input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}
.textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #333;
}
.textarea.sm {
  min-height: 120rpx;
}
.ph {
  color: #bbb;
}
.switch-row {
  justify-content: space-between;
}
.switch-label {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.hint {
  font-size: 24rpx;
  color: #999;
}
.logo-actions {
  margin-top: 12rpx;
}
.link {
  font-size: 24rpx;
  color: #ff6b35;
}
.coord {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 16rpx;
  word-break: break-all;
}
.coord.empty {
  color: #999;
}
.map-btn {
  margin-top: 8rpx;
  background: #fff7f2;
  color: #ff6b35;
  border: 1rpx solid #ffccb3;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.map-tip {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #999;
  line-height: 1.5;
}
.footer-space {
  height: 160rpx;
}
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.submit {
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  color: #fff;
  border: none;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
