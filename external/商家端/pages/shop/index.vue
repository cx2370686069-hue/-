<template>
  <scroll-view scroll-y class="page" :show-scrollbar="false">
    <view class="hero">
      <view class="cover" @click="chooseAndUploadImage('cover')">
        <image v-if="coverDisplay" class="cover-img" :src="coverDisplay" mode="aspectFill" />
        <view class="cover-mask">
          <text class="cover-tip">{{ coverUploading ? '封面上传中...' : '点击更换店铺封面' }}</text>
        </view>
      </view>
      <view class="hero-main">
        <view class="avatar-block">
          <view class="avatar" @click="chooseAndUploadImage('logo')">
            <image v-if="logoDisplay" class="avatar-img" :src="logoDisplay" mode="aspectFill" />
            <text v-else class="avatar-text">{{ form.name ? form.name.slice(0, 1) : '店' }}</text>
          </view>
          <text class="avatar-action">{{ logoUploading ? '头像上传中...' : '点击更换头像' }}</text>
        </view>
        <view class="hero-text">
          <text class="hero-title">{{ form.name || '店铺基础设置' }}</text>
          <text class="hero-sub">店铺头像、封面和基础资料在此统一维护</text>
        </view>
      </view>
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

      <view class="cell">
        <text class="label">主营类目</text>
        <picker :range="categoryOptions" :value="currentCategoryIndex > -1 ? currentCategoryIndex : 0" :disabled="!categoryOptions.length" @change="onCategoryChange">
          <view class="picker-line">{{ form.category || '请选择店铺主营类目' }}</view>
        </picker>
        <text v-if="categoryLoading" class="picker-tip">主营类目加载中...</text>
        <text v-else-if="categoryLoadFailed" class="picker-tip error">主营类目加载失败，请稍后重试</text>
        <text v-else-if="!categoryOptions.length" class="picker-tip error">暂无可选主营类目</text>
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
import { getMerchantPrimaryCategories } from '@/api/common.js'
import { getShopInfo, createShop, updateShopInfo, uploadShopImage } from '@/api/shop.js'
import { BASE_URL, TIANDITU_TK } from '@/config/index.js'

const logShopMapStep = (step, payload) => {
  try {
    console.log('[shop-setting-map][' + step + ']', payload || '')
  } catch (e) {}
}

const logShopSaveStep = (step, payload) => {
  try {
    console.log('[shop-setting-save][' + step + ']', payload || '')
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

const DEFAULT_FORM = () => ({
  name: '',
  phone: '',
  category: '',
  description: '',
  logo: '',
  cover: '',
  address: '',
  business_license: '',
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
      logoPreviewLocal: '',
      coverPreviewLocal: '',
      logoUploading: false,
      coverUploading: false,
      categoryOptions: [],
      categoryLoading: false,
      categoryLoadFailed: false,
      form: DEFAULT_FORM()
    }
  },
  computed: {
    logoDisplay() {
      return this.logoPreviewLocal || this.resolveImageUrl(this.form.logo)
    },
    coverDisplay() {
      return this.coverPreviewLocal || this.resolveImageUrl(this.form.cover)
    },
    hasCoords() {
      return !!getValidCoordinatePair(this.form.latitude, this.form.longitude)
    },
    currentCategoryIndex() {
      return this.categoryOptions.indexOf(this.form.category)
    }
  },
  onLoad() {
    this.loadCategoryOptions()
    this.loadShopData('page-onload')
  },
  methods: {
    normalizeCategoryOptions(res) {
      const raw = res && typeof res === 'object' && res.data !== undefined ? res.data : res
      const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.data) ? raw.data : []
      return arr.map((item) => String(item || '').trim()).filter(Boolean)
    },
    formatCoord(v) {
      if (v == null || v === '') return '-'
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(6) : String(v)
    },
    resolveImageUrl(url) {
      const value = url != null ? String(url).trim() : ''
      if (!value) return ''
      if (/^(https?:)?\/\//i.test(value) || /^data:image/i.test(value) || /^blob:/i.test(value)) {
        return value
      }
      return value.startsWith('/') ? BASE_URL + value : BASE_URL + '/' + value
    },
    async loadCategoryOptions() {
      this.categoryLoading = true
      this.categoryLoadFailed = false
      try {
        const res = await getMerchantPrimaryCategories()
        this.categoryOptions = this.normalizeCategoryOptions(res)
      } catch (e) {
        this.categoryOptions = []
        this.categoryLoadFailed = true
      } finally {
        this.categoryLoading = false
      }
    },
    normalizeMerchant(raw) {
      if (!raw || typeof raw !== 'object') return null
      const m = raw.merchant && typeof raw.merchant === 'object' ? raw.merchant : raw
      const coordinatePair = getValidCoordinatePair(
        m.latitude != null ? m.latitude : (m.delivery_latitude != null ? m.delivery_latitude : m.lat),
        m.longitude != null ? m.longitude : (m.delivery_longitude != null ? m.delivery_longitude : m.lng)
      )
      return {
        name: m.name != null ? String(m.name) : '',
        phone: m.phone != null ? String(m.phone) : '',
        category: m.category != null ? String(m.category) : '',
        description: m.description != null ? String(m.description) : '',
        logo: m.logo != null ? String(m.logo) : '',
        cover: m.cover != null ? String(m.cover) : '',
        address: m.address != null ? String(m.address) : '',
        business_license: m.business_license != null ? String(m.business_license) : '',
        latitude: coordinatePair ? coordinatePair.latitude : null,
        longitude: coordinatePair ? coordinatePair.longitude : null,
        status: m.status === 0 ? 0 : 1,
        delivery_radius: m.delivery_radius != null && m.delivery_radius !== '' ? Number(m.delivery_radius) : 3
      }
    },
    async loadShopData(source = 'default') {
      try {
        const res = await getShopInfo()
        logShopSaveStep('loadShopData-response', {
          source,
          url: BASE_URL + '/api/merchant/my',
          response: res
        })
        const raw = res && typeof res === 'object' && 'data' in res ? res.data : res
        const merchant = this.normalizeMerchant(raw)
        logShopSaveStep('loadShopData-normalized', {
          source,
          raw,
          merchant
        })
        const id = raw && raw.id != null ? raw.id : merchant && raw && raw.merchant && raw.merchant.id
        const hasShop = !!(merchant && (merchant.name || id != null))
        if (hasShop) {
          this.isCreateMode = false
          this.form = { ...DEFAULT_FORM(), ...merchant }
          this.logoPreviewLocal = ''
          this.coverPreviewLocal = ''
          logShopSaveStep('loadShopData-form-applied', {
            source,
            form: this.form
          })
        } else {
          this.isCreateMode = true
          this.form = DEFAULT_FORM()
          this.logoPreviewLocal = ''
          this.coverPreviewLocal = ''
          logShopSaveStep('loadShopData-empty', { source })
        }
      } catch (e) {
        logShopSaveStep('loadShopData-error', {
          source,
          url: BASE_URL + '/api/merchant/my',
          error: e,
          message: e && (e.detail || e.message || e.msg),
          statusCode: e && e.statusCode,
          data: e && e.data
        })
        console.log('未获取到店铺或接口异常，进入创建模式', e)
        this.isCreateMode = true
        this.form = DEFAULT_FORM()
        this.logoPreviewLocal = ''
        this.coverPreviewLocal = ''
      }
    },
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0
    },
    onCategoryChange(e) {
      if (!this.categoryOptions.length) return
      const index = Number(e && e.detail && e.detail.value)
      this.form.category = this.categoryOptions[index] || ''
    },
    async chooseAndUploadImage(field) {
      const isLogo = field === 'logo'
      const uploadingKey = isLogo ? 'logoUploading' : 'coverUploading'
      const previewKey = isLogo ? 'logoPreviewLocal' : 'coverPreviewLocal'
      const fieldLabel = isLogo ? '头像' : '封面'

      if (this[uploadingKey]) return

      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const filePath = res.tempFilePaths && res.tempFilePaths[0]
          if (!filePath) return

          this[uploadingKey] = true
          try {
            const uploadRes = await uploadShopImage(filePath)
            const url = uploadRes && uploadRes.data && uploadRes.data.url ? String(uploadRes.data.url) : ''
            if (!url) {
              throw new Error('上传成功但未返回图片地址')
            }
            this.form[field] = url
            this[previewKey] = filePath
            uni.showToast({ title: fieldLabel + '上传成功', icon: 'success' })
          } catch (e) {
            const msg = (e && (e.message || e.detail || e.msg)) || (fieldLabel + '上传失败')
            uni.showToast({ title: msg, icon: 'none' })
          } finally {
            this[uploadingKey] = false
          }
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
      const address = this.form.address != null ? String(this.form.address) : ''
      logShopMapStep('navigate-to-picker', { lat, lng, address })
      uni.navigateTo({
        url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
        events: {
          picked: (data) => {
            logShopMapStep('picked-received', data)
            if (!data) return
            const coordinatePair = getValidCoordinatePair(data.latitude, data.longitude)
            if (!coordinatePair) {
              this.form.latitude = null
              this.form.longitude = null
              uni.showToast({ title: '地图选点无效，请重新选点', icon: 'none' })
              return
            }
            this.form.latitude = coordinatePair.latitude
            this.form.longitude = coordinatePair.longitude
            if (data.address) {
              this.form.address = data.address
            }
            if (data.town && !this.form.address) {
              this.form.address = data.town
            }
            logShopMapStep('picked-applied', {
              latitude: this.form.latitude,
              longitude: this.form.longitude,
              address: this.form.address
            })
          }
        }
      })
    },
    buildPayload(includeStatus = true) {
      const logo = (this.form.logo || '').trim()
      const cover = (this.form.cover || '').trim()
      const businessLicense = (this.form.business_license || '').trim()
      const coordinatePair = getValidCoordinatePair(this.form.latitude, this.form.longitude)
      const payload = {
        name: (this.form.name || '').trim(),
        phone: (this.form.phone || '').trim(),
        category: (this.form.category || '').trim(),
        description: (this.form.description || '').trim(),
        address: (this.form.address || '').trim(),
        delivery_radius: Number(this.form.delivery_radius) || 0
      }
      if (includeStatus) {
        payload.status = this.form.status
      }
      if (logo) {
        payload.logo = logo
      }
      if (cover) {
        payload.cover = cover
      }
      if (businessLicense) {
        payload.business_license = businessLicense
      }
      if (coordinatePair) {
        payload.latitude = coordinatePair.latitude
        payload.longitude = coordinatePair.longitude
      }
      return payload
    },
    async submitForm() {
      const p = this.buildPayload(this.isCreateMode)
      logShopSaveStep('submitForm-form-model', {
        form: {
          ...this.form,
          latitude: this.form.latitude,
          longitude: this.form.longitude,
          address: this.form.address
        },
        hasCoords: this.hasCoords,
        isCreateMode: this.isCreateMode
      })
      logShopSaveStep('submitForm-payload', p)
      if (!p.name) {
        uni.showToast({ title: '请填写店名', icon: 'none' })
        return
      }
      if (!p.phone) {
        uni.showToast({ title: '请填写联系电话', icon: 'none' })
        return
      }
      if (this.categoryLoading) {
        uni.showToast({ title: '主营类目加载中，请稍后', icon: 'none' })
        return
      }
      if (!this.categoryOptions.length) {
        uni.showToast({ title: '主营类目暂不可用，请稍后重试', icon: 'none' })
        return
      }
      if (!p.category) {
        uni.showToast({ title: '请选择店铺主营类目', icon: 'none' })
        return
      }
      if (!this.categoryOptions.includes(p.category)) {
        uni.showToast({ title: '请选择有效的主营类目', icon: 'none' })
        return
      }
      if (!p.address) {
        uni.showToast({ title: '请填写详细地址', icon: 'none' })
        return
      }
      const coordinatePair = getValidCoordinatePair(this.form.latitude, this.form.longitude)
      if (!coordinatePair || p.latitude == null || p.longitude == null) {
        uni.showToast({ title: '地图坐标无效，请重新选点', icon: 'none' })
        return
      }

      this.submitting = true
      try {
        if (this.isCreateMode) {
          logShopSaveStep('submitForm-request', {
            url: BASE_URL + '/api/merchant/create',
            method: 'POST',
            payload: p
          })
          const res = await createShop(p)
          logShopSaveStep('submitForm-response', {
            url: BASE_URL + '/api/merchant/create',
            response: res
          })
          if (res && (res.code === 200 || res.code === 201 || res.success)) {
            uni.showToast({ title: '创建成功', icon: 'success' })
            this.isCreateMode = false
            await this.loadShopData('after-create-success')
          } else {
            uni.showToast({ title: (res && res.message) || '创建失败', icon: 'none' })
          }
        } else {
          logShopSaveStep('submitForm-request', {
            url: BASE_URL + '/api/merchant/update',
            method: 'PUT',
            payload: p
          })
          const res = await updateShopInfo(p)
          logShopSaveStep('submitForm-response', {
            url: BASE_URL + '/api/merchant/update',
            response: res
          })
          if (res && (res.code === 200 || res.success)) {
            uni.showToast({ title: '保存成功', icon: 'success' })
            await this.loadShopData('after-update-success')
          } else {
            uni.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
          }
        }
      } catch (e) {
        logShopSaveStep('submitForm-error', {
          url: BASE_URL + (this.isCreateMode ? '/api/merchant/create' : '/api/merchant/update'),
          error: e,
          message: e && (e.detail || e.message || e.msg),
          statusCode: e && e.statusCode,
          data: e && e.data
        })
        const msg = (e && (e.detail || e.message || e.msg)) || '保存失败'
        uni.showToast({ title: msg, icon: 'none' })
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
  padding: 24rpx 24rpx 40rpx;
  color: #fff;
}
.cover {
  position: relative;
  height: 260rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.16);
}
.cover-img {
  width: 100%;
  height: 100%;
}
.cover-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.48));
}
.cover-tip {
  font-size: 24rpx;
  color: #fff;
}
.hero-main {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
}
.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 24rpx;
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
}
.avatar-action {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.92);
}
.hero-text {
  flex: 1;
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
.picker-line {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}
.picker-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #999;
}
.picker-tip.error {
  color: #ff4d4f;
}
.textarea {
  width: 100%;
  min-height: 88rpx;
  font-size: 28rpx;
  color: #333;
}
.textarea.sm {
  min-height: 72rpx;
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
