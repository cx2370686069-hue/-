<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>

    <view v-else-if="hasShop && shopDisplay" class="card">
      <view class="h1">店铺信息</view>
      <view class="row">
        <text class="label">店铺名称</text>
        <text class="val">{{ shopDisplay.name }}</text>
      </view>
      <view class="row">
        <text class="label">联系电话</text>
        <text class="val">{{ shopDisplay.phone }}</text>
      </view>
      <view class="row">
        <text class="label">详细地址</text>
        <text class="val">{{ shopDisplay.address }}</text>
      </view>
      <view class="row">
        <text class="label">主营类目</text>
        <text class="val">{{ shopDisplay.category || '未填写' }}</text>
      </view>
      <view class="row">
        <text class="label">起送价</text>
        <text class="val">{{ shopDisplay.min_price }}</text>
      </view>
      <view class="row">
        <text class="label">配送费</text>
        <text class="val">{{ shopDisplay.delivery_fee }}</text>
      </view>
      <view v-if="shopDisplay.business_license" class="license-block">
        <text class="label-row">营业执照</text>
        <image
          class="license-img"
          :src="shopDisplay.business_license"
          mode="widthFix"
          @click="previewUrl(shopDisplay.business_license)"
        />
      </view>
      <button class="btn" type="primary" @click="goHome">进入工作台</button>
    </view>

    <view v-else class="card">
      <view class="h1">申请开店</view>
      <view class="field">
        <text class="label">店铺名称</text>
        <input class="input" v-model="form.name" placeholder="店铺名称" />
      </view>
      <view class="field">
        <text class="label">联系电话</text>
        <input class="input" v-model="form.phone" type="number" maxlength="11" placeholder="手机号" />
      </view>
      <view class="field">
        <text class="label">详细地址</text>
        <input class="input" v-model="form.address" placeholder="详细地址" />
      </view>
      <view class="field">
        <text class="label">店铺位置</text>
        <view class="picker-line coord-line" @click="openTiandituPicker">
          <text v-if="hasCoords">纬度 {{ formatCoord(form.latitude) }}，经度 {{ formatCoord(form.longitude) }}</text>
          <text v-else class="placeholder-text">请在地图上选择店铺位置</text>
        </view>
        <button class="location-btn" type="default" @click="openTiandituPicker">在地图上选择店铺位置</button>
        <text class="picker-tip">使用天地图选点，提交真实 latitude / longitude</text>
      </view>
      <view class="field">
        <text class="label">店铺主营类目</text>
        <picker :range="categoryOptions" :value="currentCategoryIndex > -1 ? currentCategoryIndex : 0" :disabled="!categoryOptions.length" @change="onCategoryChange">
          <view class="picker-line">{{ form.category || '请选择店铺主营类目' }}</view>
        </picker>
        <text v-if="categoryLoading" class="picker-tip">主营类目加载中...</text>
        <text v-else-if="categoryLoadFailed" class="picker-tip error">主营类目加载失败，请稍后重试</text>
        <text v-else-if="!categoryOptions.length" class="picker-tip error">暂无可选主营类目</text>
      </view>
      <view class="field">
        <text class="label">起送价</text>
        <input class="input" v-model="form.min_price" type="digit" placeholder="元" />
      </view>
      <view class="field">
        <text class="label">配送费</text>
        <input class="input" v-model="form.delivery_fee" type="digit" placeholder="元" />
      </view>
      <view class="field">
        <text class="label">上传营业执照 (business_license)</text>
        <button
          class="upload-btn"
          type="default"
          :disabled="uploadingLicense"
          :loading="uploadingLicense"
          @click="chooseAndUploadLicense"
        >
          {{ form.business_license ? '重新选择图片' : '从相册选择' }}
        </button>
        <image
          v-if="form.business_license"
          class="license-preview"
          :src="form.business_license.startsWith('http://') || form.business_license.startsWith('https://') ? form.business_license : (form.business_license.startsWith('/') ? BASE_URL + form.business_license : BASE_URL + '/' + form.business_license)"
          mode="widthFix"
          @click="previewUrl(form.business_license.startsWith('http://') || form.business_license.startsWith('https://') ? form.business_license : (form.business_license.startsWith('/') ? BASE_URL + form.business_license : BASE_URL + '/' + form.business_license))"
        />
      </view>
      <button class="btn" type="primary" :loading="submitting" @click="submit">提交开店申请</button>
    </view>
  </view>
</template>

<script>
import { getMerchantPrimaryCategories } from '@/api/common.js'
import { getToken } from '@/utils/auth.js'
import { BASE_URL, TIANDITU_TK } from '@/config/index.js'

/** 与 config 中 BASE_URL 一致，避免走 utils/request.js（401 会误报「接口无权限或未实现」） */
const MERCHANT_MY_URL = BASE_URL + '/api/merchant/my'
const MERCHANT_CREATE_URL = BASE_URL + '/api/merchant/create'

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
      loading: true,
      hasShop: false,
      shopDisplay: null,
      categoryOptions: [],
      categoryLoading: false,
      categoryLoadFailed: false,
      routeToken: '',
      submitting: false,
      uploadingLicense: false,
      form: {
        name: '',
        phone: '',
        address: '',
        category: '',
        min_price: '',
        delivery_fee: '',
        business_license: '',
        latitude: null,
        longitude: null
      }
    }
  },
  computed: {
    currentCategoryIndex() {
      return this.categoryOptions.indexOf(this.form.category)
    },
    hasCoords() {
      return !!getValidCoordinatePair(this.form.latitude, this.form.longitude)
    }
  },
  onLoad(options) {
    const routeToken = options && options.token ? decodeURIComponent(options.token) : ''
    if (routeToken) {
      this.routeToken = routeToken
      uni.setStorageSync('token', routeToken)
    }
  },
  onShow() {
    const token = this.routeToken || getToken() || uni.getStorageSync('token') || ''
    if (!token) {
      uni.redirectTo({ url: '/pages/login/index' })
      return
    }
    uni.setStorageSync('token', token)
    this.loadCategoryOptions()
    this.loadMerchant()
  },
  methods: {
    normalizeCategoryOptions(res) {
      const raw = res && typeof res === 'object' && res.data !== undefined ? res.data : res
      const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.data) ? raw.data : []
      return arr.map((item) => String(item || '').trim()).filter(Boolean)
    },
    normalizeRaw(resBody) {
      if (!resBody || typeof resBody !== 'object') return null
      return 'data' in resBody && resBody.data !== undefined ? resBody.data : resBody
    },
    formatCoord(v) {
      if (v == null || v === '') return '-'
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(6) : String(v)
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
    loadMerchant() {
      this.loading = true
      const token = this.routeToken || uni.getStorageSync('token') || getToken() || ''
      if (!token) {
        this.loading = false
        uni.redirectTo({ url: '/pages/login/index' })
        return
      }
      uni.request({
        url: MERCHANT_MY_URL,
        method: 'GET',
        header: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        success: (res) => {
          const sc = res.statusCode
          if (sc === 404) {
            this.hasShop = false
            this.shopDisplay = null
            return
          }
          if (sc === 401 || sc === 403) {
            uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
            setTimeout(() => {
              uni.redirectTo({ url: '/pages/login/index' })
            }, 1200)
            return
          }
          if (sc !== 200) {
            this.hasShop = false
            this.shopDisplay = null
            return
          }
          const resBody = res.data
          const raw = this.normalizeRaw(resBody)
          if (!raw || typeof raw !== 'object') {
            this.hasShop = false
            this.shopDisplay = null
            return
          }
          const id = raw.id
          const name = raw.name
          if (name || id != null) {
            this.hasShop = true
            this.shopDisplay = {
              name: name != null ? String(name) : '',
              phone: raw.phone != null ? String(raw.phone) : '',
              address: raw.address != null ? String(raw.address) : '',
              category: raw.category != null ? String(raw.category) : '',
              min_price: raw.min_price != null ? raw.min_price : '',
              delivery_fee: raw.delivery_fee != null ? raw.delivery_fee : '',
              business_license:
                raw.business_license != null ? String(raw.business_license) : ''
            }
          } else {
            this.hasShop = false
            this.shopDisplay = null
          }
        },
        fail: () => {
          this.hasShop = false
          this.shopDisplay = null
          uni.showToast({ title: '网络异常', icon: 'none' })
        },
        complete: () => {
          this.loading = false
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
      uni.navigateTo({
        url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
        events: {
          picked: (data) => {
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
            } else if (data.town && !this.form.address) {
              this.form.address = data.town
            }
          }
        }
      })
    },
    goHome() {
      uni.reLaunch({ url: '/pages/index/index' })
    },
    previewUrl(url) {
      if (!url) return
      uni.previewImage({ urls: [url], current: url })
    },
    chooseAndUploadLicense() {
      const token = uni.getStorageSync('token') || ''
      if (!token) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.uploadingLicense = true
          uni.uploadFile({
            url: BASE_URL + '/api/upload/image',
            filePath: res.tempFilePaths[0],
            name: 'file',
            header: {
              Authorization: 'Bearer ' + token
            },
            success: (uploadRes) => {
              try {
                const data = JSON.parse(uploadRes.data)
                if (data.code === 200) {
                  this.form.business_license = data.data.url
                  uni.showToast({ title: '上传成功', icon: 'success' })
                } else {
                  uni.showToast({ title: data.message || '上传失败', icon: 'none' })
                }
              } catch (e) {
                uni.showToast({ title: '解析失败', icon: 'none' })
              }
            },
            fail: () => {
              uni.showToast({ title: '上传失败', icon: 'none' })
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
    onCategoryChange(e) {
      if (!this.categoryOptions.length) return
      const index = Number(e && e.detail && e.detail.value)
      this.form.category = this.categoryOptions[index] || ''
    },
    submit() {
      const name = (this.form.name || '').trim()
      const phone = (this.form.phone || '').trim()
      const address = (this.form.address || '').trim()
      const category = (this.form.category || '').trim()
      const minPrice = parseFloat(this.form.min_price)
      const deliveryFee = parseFloat(this.form.delivery_fee)
      const business_license = (this.form.business_license || '').trim()
      const token = uni.getStorageSync('token') || ''

      if (!name) {
        uni.showToast({ title: '请填写店铺名称', icon: 'none' })
        return
      }
      if (!phone) {
        uni.showToast({ title: '请填写联系电话', icon: 'none' })
        return
      }
      if (!address) {
        uni.showToast({ title: '请填写详细地址', icon: 'none' })
        return
      }
      if (!this.hasCoords) {
        uni.showToast({ title: '请在地图上选择店铺位置', icon: 'none' })
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
      if (!category) {
        uni.showToast({ title: '请选择店铺主营类目', icon: 'none' })
        return
      }
      if (!this.categoryOptions.includes(category)) {
        uni.showToast({ title: '请选择有效的主营类目', icon: 'none' })
        return
      }
      if (Number.isNaN(minPrice) || minPrice < 0) {
        uni.showToast({ title: '请填写有效起送价', icon: 'none' })
        return
      }
      if (Number.isNaN(deliveryFee) || deliveryFee < 0) {
        uni.showToast({ title: '请填写有效配送费', icon: 'none' })
        return
      }
      if (!token) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      const coordinatePair = getValidCoordinatePair(this.form.latitude, this.form.longitude)
      if (!coordinatePair) {
        uni.showToast({ title: '地图坐标无效，请重新选点', icon: 'none' })
        return
      }

      const data = {
        name,
        phone,
        address,
        category,
        min_price: minPrice,
        delivery_fee: deliveryFee,
        business_license,
        latitude: coordinatePair.latitude,
        longitude: coordinatePair.longitude
      }

      this.submitting = true
      uni.request({
        url: MERCHANT_CREATE_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        data,
        success: (res) => {
          const sc = res.statusCode
          const body = res.data

          if (sc === 401 || sc === 403) {
            uni.showToast({ title: '登录已失效或无权限', icon: 'none' })
            return
          }

          if (sc === 200 || sc === 201) {
            if (body && typeof body === 'object') {
              const c = body.code
              if (c != null && c !== 0 && c !== 200 && c !== 201 && body.success !== true) {
                const msg = body.message || body.msg || '提交失败'
                uni.showToast({ title: String(msg), icon: 'none' })
                return
              }
            }
            uni.showToast({ title: '提交成功', icon: 'success' })
            setTimeout(() => {
              uni.reLaunch({ url: '/pages/index/index' })
            }, 600)
            return
          }

          let msg = '提交失败'
          if (body && typeof body === 'object') {
            msg = body.detail || body.message || body.msg || msg
          }
          uni.showToast({ title: typeof msg === 'string' ? msg : '提交失败', icon: 'none' })
        },
        fail: () => {
          uni.showToast({ title: '网络错误', icon: 'none' })
        },
        complete: () => {
          this.submitting = false
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f5f5f5;
  box-sizing: border-box;
}
.hint {
  padding: 40rpx;
  text-align: center;
  color: #666;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 32rpx;
}
.h1 {
  font-size: 34rpx;
  font-weight: bold;
  margin-bottom: 28rpx;
}
.row {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eee;
  font-size: 28rpx;
}
.row .label {
  width: 180rpx;
  color: #666;
  flex-shrink: 0;
}
.row .val {
  flex: 1;
  color: #333;
  word-break: break-all;
}
.field {
  margin-bottom: 24rpx;
}
.field .label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
}
.input {
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
}
.picker-line {
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  color: #333;
}
.coord-line {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  box-sizing: border-box;
}
.placeholder-text {
  color: #999;
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
.location-btn {
  margin-top: 12rpx;
  font-size: 26rpx;
}
.btn {
  margin-top: 32rpx;
}
.upload-btn {
  font-size: 28rpx;
  margin-bottom: 16rpx;
}
.license-preview {
  width: 100%;
  max-height: 360rpx;
  border-radius: 8rpx;
  border: 1rpx solid #eee;
  background: #fafafa;
}
.license-block {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eee;
}
.label-row {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}
.license-img {
  width: 100%;
  max-height: 400rpx;
  border-radius: 8rpx;
}
</style>
