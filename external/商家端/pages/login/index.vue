<template>
  <view class="container">
    <view class="logo-area">
      <text class="logo-emoji">🏪</text>
      <text class="logo-title">固始县外卖</text>
      <text class="logo-sub">商家端 · 店铺经营与订单管理</text>
    </view>

    <view class="form-card">
      <view class="tab-bar">
        <text :class="['tab-item', !isRegister && 'tab-active']" @click="switchAuthMode(false)">登录</text>
        <text :class="['tab-item', isRegister && 'tab-active']" @click="switchAuthMode(true)">注册</text>
      </view>

      <view class="input-group">
        <text class="input-icon">📱</text>
        <input class="input" v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>

      <view v-if="isRegister" class="input-group verify-row">
        <text class="input-icon">🔢</text>
        <input class="input" v-model="verifyCode" placeholder="请输入短信验证码（预留）" maxlength="6" />
        <button class="verify-btn" type="default" disabled>发送验证码</button>
      </view>

      <view class="input-group">
        <text class="input-icon">🔒</text>
        <input class="input" v-model="password" placeholder="请输入密码" password />
      </view>

      <view v-if="isRegister" class="input-group">
        <text class="input-icon">✅</text>
        <input class="input" v-model="confirmPassword" placeholder="请再次输入密码" password />
      </view>

      <view v-if="isRegister" class="input-group">
        <text class="input-icon">🏪</text>
        <input class="input" v-model="store_name" placeholder="店铺名称（必填）" />
      </view>

      <view v-if="isRegister" class="input-group picker-row">
        <text class="input-icon">🗺️</text>
        <view class="picker-block">
          <text class="picker-label">店铺位置（必填）</text>
          <view class="picker-value coord-text" v-if="hasLocationCoords">
            纬度 {{ formatCoord(latitude) }}，经度 {{ formatCoord(longitude) }}
          </view>
          <view class="picker-value" v-else>{{ address ? address : '请先在地图上选择店铺位置' }}</view>
          <text v-if="address" class="picker-tip">{{ address }}</text>
          <button class="location-btn" type="default" @click="openTiandituPicker">在地图上选择店铺位置</button>
        </view>
      </view>

      <view v-if="isRegister" class="input-group picker-row">
        <text class="input-icon">📍</text>
        <view class="picker-block">
          <text class="picker-label">所属经营区域（必选）</text>
          <picker
            mode="selector"
            :range="businessScopeOptions"
            range-key="label"
            :value="scopePickerIndex"
            @change="onBusinessScopeChange"
          >
            <view class="picker-value">{{ currentBusinessScopeLabel }}</view>
          </picker>
          <text class="picker-tip">用于区分商家所属区域线，不用于区分美食、超市等主营类目</text>
        </view>
      </view>

      <view v-if="isRegister" class="input-group picker-row">
        <text class="input-icon">🏷️</text>
        <view class="picker-block">
          <text class="picker-label">主营类目（必填）</text>
          <picker
            mode="selector"
            :range="categoryOptions"
            :value="categoryPickerIndex"
            :disabled="!categoryOptions.length"
            @change="onCategoryChange"
          >
            <view class="picker-value">{{ currentCategoryLabel }}</view>
          </picker>
          <text v-if="categoryLoading" class="picker-tip">主营类目加载中...</text>
          <text v-else-if="categoryLoadFailed" class="picker-tip error">主营类目加载失败，请稍后重试</text>
          <text v-else-if="!categoryOptions.length" class="picker-tip error">暂无可选主营类目</text>
        </view>
      </view>

      <view v-if="isRegister && category === '超市'" class="input-group delivery-row">
        <text class="input-icon">🚚</text>
        <view class="picker-block">
          <text class="picker-label">经营方向</text>
          <radio-group class="delivery-group" @change="onSupermarketChannelDirectionChange">
            <label
              v-for="item in supermarketChannelOptions"
              :key="item.value"
              class="delivery-option"
            >
              <radio
                :value="item.value"
                :checked="supermarket_channel_direction === item.value"
                color="#FF6B35"
              />
              <text class="delivery-text">{{ item.label }}</text>
            </label>
          </radio-group>
        </view>
      </view>

      <view v-if="isRegister && category === '超市'" class="input-group delivery-row">
        <text class="input-icon">🚚</text>
        <view class="picker-block">
          <text class="picker-label">配送方式（超市必填）</text>
          <radio-group class="delivery-group" @change="onSupermarketDeliveryPermissionChange">
            <label
              v-for="item in supermarketDeliveryOptions"
              :key="item.value"
              class="delivery-option"
            >
              <radio
                :value="item.value"
                :checked="supermarket_delivery_permission === item.value"
                color="#FF6B35"
              />
              <text class="delivery-text">{{ item.label }}</text>
            </label>
          </radio-group>
        </view>
      </view>

      <view v-if="isRegister && business_scope === 'town_food'" class="input-group picker-row">
        <text class="input-icon">🏘️</text>
        <view class="picker-block">
          <text class="picker-label">所属乡镇（乡镇商家必选）</text>
          <picker
            mode="selector"
            :range="townOptions"
            range-key="label"
            :value="townPickerIndex"
            @change="onTownChange"
          >
            <view class="picker-value">{{ currentTownLabel }}</view>
          </picker>
        </view>
      </view>

      <view v-if="isRegister" class="input-group license-row">
        <text class="input-icon">📄</text>
        <view class="picker-block">
          <text class="picker-label">营业执照（必填）</text>
          <button
            class="upload-btn"
            type="default"
            :disabled="uploadingLicense"
            :loading="uploadingLicense"
            @click="chooseAndUploadLicense"
          >
            {{ business_license ? '重新上传营业执照' : '上传营业执照' }}
          </button>
          <image
            v-if="businessLicensePreviewUrl"
            class="license-preview"
            :src="businessLicensePreviewUrl"
            mode="widthFix"
            @click="previewBusinessLicense"
          />
        </view>
      </view>

      <button class="submit-btn" @click="handleSubmit" :loading="loading">
        {{ isRegister ? '注册成为商家' : '登 录' }}
      </button>
    </view>
  </view>
</template>

<script>
import { getMerchantPrimaryCategories, getTownServiceAreas } from '@/api/common.js'
import { registerMerchant, login } from '@/api/user.js'
import { BASE_URL, TIANDITU_TK } from '@/config/index.js'
import { useUserStore } from '@/store/user.js'
import { initSocket } from '@/utils/socket.js'
import { ensureMerchantNotifyReady } from '@/utils/merchant-notify.js'
import { clearAuth, getUserId, isMerchantUser } from '@/utils/auth.js'
import { isValidPhone, isValidPassword, isNotEmpty } from '@/utils/validate.js'

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

export default {
  data() {
    return {
      isRegister: false,
      phone: '',
      verifyCode: '',
      password: '',
      confirmPassword: '',
      store_name: '',
      address: '',
      latitude: null,
      longitude: null,
      category: '',
      supermarket_channel_direction: '普通超市',
      supermarket_delivery_permission: '',
      business_scope: 'county_food',
      business_license: '',
      businessScopeOptions: [
        { value: 'county_food', label: '固始县城县域商家' },
        { value: 'town_food', label: '乡镇商家' }
      ],
      supermarketDeliveryOptions: [
        { value: 'self_only', label: '自己配送' },
        { value: 'rider_only', label: '骑手配送' },
        { value: 'hybrid', label: '两个都支持' }
      ],
      supermarketChannelOptions: [
        { value: '普通超市', label: '普通超市' },
        { value: '冷饮雪糕批发', label: '冷饮雪糕批发' }
      ],
      categoryOptions: [],
      categoryPickerIndex: 0,
      categoryLoading: false,
      categoryLoadFailed: false,
      townOptions: [],
      townPickerIndex: 0,
      townLoading: false,
      uploadingLicense: false,
      loading: false
    }
  },
  computed: {
    scopePickerIndex() {
      const i = this.businessScopeOptions.findIndex((o) => o.value === this.business_scope)
      return i >= 0 ? i : 0
    },
    currentBusinessScopeLabel() {
      const o = this.businessScopeOptions[this.scopePickerIndex]
      return o ? o.label : '请选择所属经营区域'
    },
    hasLocationCoords() {
      return !!getValidCoordinatePair(this.latitude, this.longitude)
    },
    currentCategoryLabel() {
      if (this.category) return this.category
      return this.categoryLoading ? '主营类目加载中...' : '请选择主营类目'
    },
    currentTownLabel() {
      const o = this.townOptions[this.townPickerIndex]
      if (o) return o.label
      return this.townLoading ? '乡镇加载中...' : '请选择所属乡镇'
    },
    businessLicensePreviewUrl() {
      if (!this.business_license) return ''
      if (
        this.business_license.startsWith('http://') ||
        this.business_license.startsWith('https://') ||
        this.business_license.startsWith('data:image') ||
        this.business_license.startsWith('blob:')
      ) {
        return this.business_license
      }
      return this.business_license.startsWith('/') ? BASE_URL + this.business_license : BASE_URL + '/' + this.business_license
    }
  },
  methods: {
    resetRegisterForm() {
      this.password = ''
      this.confirmPassword = ''
      this.verifyCode = ''
      this.store_name = ''
      this.address = ''
      this.latitude = null
      this.longitude = null
      this.category = ''
      this.supermarket_channel_direction = '普通超市'
      this.supermarket_delivery_permission = ''
      this.business_scope = 'county_food'
      this.business_license = ''
      this.categoryPickerIndex = 0
      this.townPickerIndex = 0
    },
    switchAuthMode(isRegister) {
      this.isRegister = isRegister
      if (isRegister) {
        this.ensureCategoryOptions()
      }
      if (isRegister && this.business_scope === 'town_food') {
        this.ensureTownOptions()
      }
    },
    onBusinessScopeChange(e) {
      const i = Number(e.detail.value)
      const o = this.businessScopeOptions[i]
      if (!o) return
      this.business_scope = o.value
      if (o.value === 'town_food') {
        this.ensureTownOptions()
      }
    },
    onTownChange(e) {
      this.townPickerIndex = Number(e.detail.value)
    },
    onCategoryChange(e) {
      if (!this.categoryOptions.length) return
      const previousCategory = this.category
      const index = Number(e.detail.value)
      this.categoryPickerIndex = index
      this.category = this.categoryOptions[index] || ''
      if (this.category === '超市' && previousCategory !== '超市') {
        this.supermarket_channel_direction = '普通超市'
        return
      }
      if (this.category !== '超市' && previousCategory === '超市') {
        this.supermarket_channel_direction = '普通超市'
        this.supermarket_delivery_permission = ''
      }
    },
    onSupermarketChannelDirectionChange(e) {
      const value = e?.detail?.value || '普通超市'
      this.supermarket_channel_direction = value === '冷饮雪糕批发' ? '冷饮雪糕批发' : '普通超市'
      console.log('[merchant-register][supermarket-direction-change]', {
        category: this.category,
        supermarket_channel_direction: this.supermarket_channel_direction
      })
    },
    onSupermarketDeliveryPermissionChange(e) {
      this.supermarket_delivery_permission = e?.detail?.value || ''
    },
    formatCoord(v) {
      if (v == null || v === '') return '-'
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(6) : String(v)
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
      const lat = this.latitude != null ? String(this.latitude) : ''
      const lng = this.longitude != null ? String(this.longitude) : ''
      const address = this.address != null ? String(this.address) : ''
      uni.navigateTo({
        url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
        events: {
          picked: (data) => {
            if (!data) return
            const coordinatePair = getValidCoordinatePair(data.latitude, data.longitude)
            if (!coordinatePair) {
              this.latitude = null
              this.longitude = null
              uni.showToast({ title: '地图选点无效，请重新选点', icon: 'none' })
              return
            }
            this.latitude = coordinatePair.latitude
            this.longitude = coordinatePair.longitude
            if (data.address) {
              this.address = data.address
            } else if (data.town) {
              this.address = data.town
            }
          }
        }
      })
    },
    async ensureCategoryOptions() {
      if (this.categoryLoading || this.categoryOptions.length) return
      this.categoryLoading = true
      this.categoryLoadFailed = false
      try {
        const res = await getMerchantPrimaryCategories()
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
        const categoryOptions = list.map((item) => String(item || '').trim()).filter(Boolean)
        if (!categoryOptions.length) {
          uni.showToast({ title: '未获取到主营类目，请稍后重试', icon: 'none' })
          return
        }
        this.categoryOptions = categoryOptions
        const currentIndex = this.categoryOptions.findIndex((item) => item === this.category)
        this.categoryPickerIndex = currentIndex >= 0 ? currentIndex : 0
      } catch (e) {
        this.categoryOptions = []
        this.categoryLoadFailed = true
      } finally {
        this.categoryLoading = false
      }
    },
    async ensureTownOptions() {
      if (this.townLoading || this.townOptions.length) return
      this.townLoading = true
      try {
        const res = await getTownServiceAreas()
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
        const townOptions = list
          .filter((item) => item?.area_code && item?.area_name)
          .map((item) => ({
            town_code: item.area_code,
            label: item.area_name
          }))

        if (!townOptions.length) {
          uni.showToast({ title: '未获取到乡镇数据，请稍后重试', icon: 'none' })
          return
        }

        this.townOptions = townOptions
        this.townPickerIndex = 0
      } catch (e) {
        this.townOptions = []
      } finally {
        this.townLoading = false
      }
    },
    chooseAndUploadLicense() {
      if (this.uploadingLicense) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (chooseRes) => {
          const filePath = chooseRes.tempFilePaths && chooseRes.tempFilePaths[0]
          if (!filePath) return
          this.uploadingLicense = true
          const token = uni.getStorageSync('token') || ''
          const header = token ? { Authorization: 'Bearer ' + token } : {}
          uni.uploadFile({
            url: BASE_URL + '/api/upload/image',
            filePath,
            name: 'file',
            header,
            success: (uploadRes) => {
              const url = this.parseUploadResponse(uploadRes.data)
              if (!url) {
                uni.showToast({ title: '营业执照上传失败', icon: 'none' })
                return
              }
              this.business_license = url
              uni.showToast({ title: '营业执照上传成功', icon: 'success' })
            },
            fail: () => {
              uni.showToast({ title: '营业执照上传失败', icon: 'none' })
            },
            complete: () => {
              this.uploadingLicense = false
            }
          })
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || '选择图片失败'
          uni.showToast({ title: msg, icon: 'none' })
        }
      })
    },
    parseUploadResponse(rawData) {
      let parsed = rawData
      if (typeof rawData === 'string') {
        try {
          parsed = JSON.parse(rawData)
        } catch (e) {
          parsed = null
        }
      }
      const data = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed
      const url = data && data.url ? data.url : ''
      return url ? String(url) : ''
    },
    previewBusinessLicense() {
      if (!this.businessLicensePreviewUrl) return
      uni.previewImage({ urls: [this.businessLicensePreviewUrl], current: this.businessLicensePreviewUrl })
    },
    extractMerchantAuditState(loginRes, userInfo) {
      const candidates = [
        loginRes?.data?.user?.audit_status,
        loginRes?.data?.audit_status,
        userInfo?.audit_status
      ]
      for (const value of candidates) {
        const auditStatus = Number(value)
        if ([0, 1, 2].includes(auditStatus)) return auditStatus
      }
      return null
    },
    handleBlockedAuditState(auditState) {
      const blockedMap = {
        0: {
          title: '待平台审核',
          content: '入驻申请已提交，请等待平台审核'
        },
        2: {
          title: '审核未通过',
          content: '入驻审核未通过，请联系平台后重新提交'
        }
      }
      const modal = blockedMap[auditState]
      if (!modal) return false
      uni.showModal({
        title: modal.title,
        content: modal.content,
        showCancel: false
      })
      return true
    },
    async handleSubmit() {
      if (!isValidPhone(this.phone)) {
        uni.showToast({ title: '请输入正确的11位手机号', icon: 'none' })
        return
      }
      if (!isValidPassword(this.password)) {
        uni.showToast({ title: '密码至少6位', icon: 'none' })
        return
      }
      if (this.isRegister && this.password !== this.confirmPassword) {
        uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
        return
      }
      if (this.isRegister && !isNotEmpty(this.store_name)) {
        uni.showToast({ title: '请填写店铺名称', icon: 'none' })
        return
      }
      if (this.isRegister && !isNotEmpty(this.address)) {
        uni.showToast({ title: '请先选择店铺位置', icon: 'none' })
        return
      }
      if (this.isRegister && !this.hasLocationCoords) {
        uni.showToast({ title: '请在地图上完成店铺选点', icon: 'none' })
        return
      }
      if (this.isRegister && this.categoryLoading) {
        uni.showToast({ title: '主营类目加载中，请稍后', icon: 'none' })
        return
      }
      if (this.isRegister && !this.categoryOptions.length) {
        uni.showToast({ title: '主营类目暂不可用，请稍后重试', icon: 'none' })
        return
      }
      if (this.isRegister && !isNotEmpty(this.category)) {
        uni.showToast({ title: '请选择主营类目', icon: 'none' })
        return
      }
      if (this.isRegister && !this.categoryOptions.includes(this.category)) {
        uni.showToast({ title: '请选择有效的主营类目', icon: 'none' })
        return
      }
      if (this.isRegister && this.category === '超市' && !isNotEmpty(this.supermarket_delivery_permission)) {
        uni.showToast({ title: '请选择超市配送方式', icon: 'none' })
        return
      }
      if (this.isRegister && this.business_scope === 'town_food') {
        const t = this.townOptions[this.townPickerIndex]
        if (!t || !t.town_code) {
          uni.showToast({ title: '请选择所属乡镇', icon: 'none' })
          return
        }
      }
      if (this.isRegister && !isNotEmpty(this.business_license)) {
        uni.showToast({ title: '请先上传营业执照', icon: 'none' })
        return
      }
      const coordinatePair = this.isRegister ? getValidCoordinatePair(this.latitude, this.longitude) : null
      if (this.isRegister && !coordinatePair) {
        uni.showToast({ title: '地图坐标无效，请重新选点', icon: 'none' })
        return
      }

      this.loading = true

      try {
        if (this.isRegister) {
          const normalizedCategory = String(this.category || '').trim()
          const normalizedSupermarketChannelDirection = String(this.supermarket_channel_direction || '').trim()
          const payload = {
            phone: this.phone,
            password: this.password,
            store_name: this.store_name.trim(),
            address: this.address.trim(),
            latitude: coordinatePair.latitude,
            longitude: coordinatePair.longitude,
            category: normalizedCategory,
            business_scope: this.business_scope,
            business_license: this.business_license.trim()
          }
          if (normalizedCategory === '超市') {
            payload.supermarket_delivery_permission = this.supermarket_delivery_permission
            if (normalizedSupermarketChannelDirection === '冷饮雪糕批发') {
              payload.channel_tags = '冷饮雪糕批发'
            }
          }
          if (this.business_scope === 'town_food') {
            payload.town_code = this.townOptions[this.townPickerIndex].town_code
          }
          console.log('[merchant-register][submit-before]', {
            category: normalizedCategory,
            supermarket_channel_direction: normalizedSupermarketChannelDirection,
            payload
          })
          await registerMerchant(payload)
          this.switchAuthMode(false)
          this.resetRegisterForm()
          uni.showModal({
            title: '入驻申请已提交',
            content: '请等待平台审核，审核通过后即可正式经营。',
            showCancel: false
          })
        } else {
          const res = await login({
            phone: this.phone,
            password: this.password
          })

          const userStore = useUserStore()

          const token =
            res.data?.token ||
            res.token ||
            res.access_token ||
            res.data?.access_token ||
            ''

          const userInfo =
            res.data?.userInfo ||
            res.data?.user ||
            res.userInfo ||
            res.user ||
            null

          if (!token || !userInfo || !isMerchantUser(userInfo) || !getUserId(userInfo)) {
            clearAuth()
            uni.showToast({ title: '登录返回数据异常，未获取到 Token', icon: 'none' })
            return
          }

          const auditState = this.extractMerchantAuditState(res, userInfo)
          if (this.handleBlockedAuditState(auditState)) {
            return
          }

          userStore.login(token, userInfo)

          const userId = getUserId(userInfo)
          initSocket(token, userId)
          ensureMerchantNotifyReady()

          uni.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            uni.reLaunch({ url: `/pages/shop/shop-apply?token=${token}` })
          }, 50)
        }
      } catch (e) {
        // 错误提示由 request.js 统一处理
      } finally {
        this.loading = false
      }
    }
  }
  ,
  onLoad() {
    this.ensureCategoryOptions()
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #FF6B35 0%, #FF8C42 40%, #f5f5f5 40%);
  padding-top: 80rpx;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 40rpx;
}
.logo-emoji {
  font-size: 100rpx;
}
.logo-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  margin-top: 10rpx;
}
.logo-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 8rpx;
}

.form-card {
  margin: 0 40rpx;
  background-color: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.1);
}

.tab-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}
.tab-item {
  font-size: 32rpx;
  color: #999;
  padding: 10rpx 40rpx;
  margin: 0 10rpx;
  border-bottom: 4rpx solid transparent;
}
.tab-active {
  color: #FF6B35;
  font-weight: bold;
  border-bottom-color: #FF6B35;
}

.input-group {
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 24rpx 0;
}
.input-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}
.input {
  flex: 1;
  font-size: 28rpx;
}
.verify-row {
  gap: 16rpx;
}
.verify-btn {
  margin: 0;
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 32rpx;
  font-size: 24rpx;
  color: #999;
  background: #f5f5f5;
}

.submit-btn {
  margin-top: 40rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  color: #fff;
  font-size: 32rpx;
  border-radius: 50rpx;
  height: 88rpx;
  line-height: 88rpx;
  border: none;
}
.picker-row {
  align-items: flex-start;
}
.picker-block {
  flex: 1;
  min-width: 0;
}
.picker-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
  display: block;
}
.picker-value {
  font-size: 28rpx;
  color: #333;
  padding: 8rpx 0;
}
.picker-tip {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #999;
}
.picker-tip.error {
  color: #ff4d4f;
}
.coord-text {
  color: #333;
}
.location-btn {
  margin: 12rpx 0 0;
  border-radius: 16rpx;
  font-size: 26rpx;
}
.license-row {
  align-items: flex-start;
}
.delivery-row {
  align-items: flex-start;
}
.delivery-group {
  margin-top: 12rpx;
}
.delivery-option {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}
.delivery-text {
  margin-left: 12rpx;
  font-size: 28rpx;
  color: #333;
}
.upload-btn {
  margin: 12rpx 0 0;
  border-radius: 16rpx;
  font-size: 26rpx;
}
.license-preview {
  width: 100%;
  margin-top: 16rpx;
  border-radius: 16rpx;
  background: #f7f7f7;
}
</style>
