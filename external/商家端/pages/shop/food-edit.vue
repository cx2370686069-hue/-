<template>
  <view class="page">
    <view class="card">
      <view class="field">
        <text class="label">商品名称 (name)</text>
        <input class="input" v-model="form.name" placeholder="请输入商品名称" />
      </view>

      <view class="field">
        <text class="label">现价 (price)</text>
        <input class="input" v-model="form.price" type="digit" placeholder="请输入售价" />
      </view>

      <view class="field">
        <text class="label">原价 (original_price)</text>
        <input class="input" v-model="form.original_price" type="digit" placeholder="选填，原价用于划线价展示" />
      </view>

      <view class="field">
        <text class="label">分类 (category_id)</text>
        <picker mode="selector" :range="categories" range-key="name" :value="pickerIndex" @change="onCategoryPick">
          <view class="picker-line">{{ categoryLabel }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">商品描述 (description)</text>
        <textarea class="textarea" v-model="form.description" placeholder="选填，输入商品描述" maxlength="2000" />
      </view>

      <view v-if="isSupermarket" class="field">
        <text class="label">单组规格（超市专属）</text>
        <input class="input" v-model="specGroupName" placeholder="请输入规格组名，例如：口味" />
        <view class="spec-options">
          <view v-for="(option, index) in specOptions" :key="'spec-' + index" class="spec-option-row">
            <input
              class="input spec-option-input"
              :value="option"
              :placeholder="'规格项' + (index + 1)"
              @input="onSpecOptionInput(index, $event)"
            />
            <button class="spec-remove-btn" type="warn" size="mini" @click="removeSpecOption(index)">删除</button>
          </view>
        </view>
        <button class="spec-add-btn" type="default" size="mini" @click="addSpecOption">添加规格项</button>
        <text class="hint">可不配置；如配置，将提交 `spec_group_name` 和 `spec_options`</text>
      </view>

      <view class="field">
        <text class="label">商品图片 (images)</text>
        <view class="upload-list">
          <view class="upload-item add" @click="chooseAndUploadImage">
            <text class="add-text">{{ uploading ? '上传中...' : '+ 上传图片' }}</text>
          </view>
          <view v-for="(url, i) in imageList" :key="url + i" class="upload-item preview" @click="chooseAndUploadImage(i)">
            <image class="preview-img" :src="formatImageUrl(url)" mode="aspectFill" />
            <view class="remove" @click.stop="removeImage(i)">×</view>
          </view>
        </view>
      </view>
    </view>

    <button class="btn-save" type="primary" :loading="saving" @click="saveProduct">保存商品</button>
    <button class="btn-delete" type="default" :loading="deleting" @click="deleteProduct">删除商品</button>
  </view>
</template>

<script>
import { BASE_URL } from '@/config/index.js'
import { getShopInfo } from '@/api/shop.js'
import request from '@/utils/request.js'

const API_BASE_URL = BASE_URL + '/api'

export default {
  data() {
    return {
      productId: '',
      categories: [],
      imageList: [],
      merchantCategory: '',
      specGroupName: '',
      specOptions: [],
      uploading: false,
      saving: false,
      deleting: false,
      form: {
        name: '',
        price: '',
        original_price: '',
        category_id: null,
        description: '',
        images: []
      }
    }
  },
  computed: {
    isSupermarket() {
      return this.merchantCategory === '超市'
    },
    pickerIndex() {
      if (!this.categories.length || this.form.category_id == null) return 0
      const i = this.categories.findIndex((c) => String(c.id) === String(this.form.category_id))
      return i >= 0 ? i : 0
    },
    categoryLabel() {
      if (!this.categories.length) return '暂无分类，请先新增分类'
      const c = this.categories[this.pickerIndex]
      return c ? `${c.name} (id:${c.id})` : '请选择分类'
    }
  },
  onLoad(options) {
    this.productId = options && options.id ? String(options.id) : ''
    if (!this.productId) {
      uni.showToast({ title: '商品ID无效', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 600)
      return
    }
    uni.setNavigationBarTitle({ title: '编辑商品' })
    this.bootstrap()
  },
  methods: {
    formatImageUrl(url) {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image') || url.startsWith('blob:')) {
        return url
      }
      return url.startsWith('/') ? BASE_URL + url : BASE_URL + '/' + url
    },
    async bootstrap() {
      await Promise.all([this.loadCategories(), this.loadProductDetail(), this.loadMerchantCategory()])
      if (this.categories.length && this.form.category_id == null) {
        this.form.category_id = this.categories[0].id
      }
    },
    normalizeCategoryList(res) {
      const arr =
        (res && res.data && Array.isArray(res.data.data) && res.data.data) ||
        (res && Array.isArray(res.data) && res.data) ||
        (res && Array.isArray(res) && res) ||
        []
      return arr
        .map((c) => ({
          id: c.id,
          name: c.name != null ? String(c.name) : ''
        }))
        .filter((c) => c.id != null)
    },
    normalizeMerchantCategory(res) {
      const raw = res && typeof res === 'object' && res.data !== undefined ? res.data : res
      const merchant = raw && typeof raw === 'object' && raw.merchant && typeof raw.merchant === 'object' ? raw.merchant : raw
      return merchant && merchant.category != null ? String(merchant.category).trim() : ''
    },
    parseImageList(rawImages) {
      if (Array.isArray(rawImages)) {
        return rawImages.filter((u) => typeof u === 'string' && u)
      }
      if (typeof rawImages !== 'string' || !rawImages.trim()) return []
      try {
        const parsed = JSON.parse(rawImages)
        return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string' && u) : []
      } catch (e) {
        return []
      }
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
      return data && data.url ? String(data.url) : ''
    },
    parseSpecOptions(rawOptions) {
      if (Array.isArray(rawOptions)) {
        return rawOptions.map((item) => String(item || '').trim()).filter(Boolean)
      }
      if (typeof rawOptions !== 'string' || !rawOptions.trim()) return []
      try {
        const parsed = JSON.parse(rawOptions)
        return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []
      } catch (e) {
        return rawOptions.split(',').map((item) => String(item || '').trim()).filter(Boolean)
      }
    },
    async loadCategories() {
      try {
        const res = await request({ url: '/merchant/my-categories', method: 'GET' })
        this.categories = this.normalizeCategoryList(res)
      } catch (e) {
        this.categories = []
      }
    },
    async loadMerchantCategory() {
      try {
        const res = await getShopInfo()
        this.merchantCategory = this.normalizeMerchantCategory(res)
      } catch (e) {
        this.merchantCategory = ''
      }
    },
    async loadProductDetail() {
      try {
        const res = await request({
          url: '/merchant/product/' + this.productId,
          method: 'GET'
        })
        const raw = res && typeof res === 'object' && res.data !== undefined ? res.data : res
        const p = raw && typeof raw === 'object' ? raw : {}
        this.form = {
          name: p.name != null ? String(p.name) : '',
          price: p.price != null ? String(p.price) : '',
          original_price: p.original_price != null ? String(p.original_price) : '',
          category_id: p.category_id != null ? p.category_id : null,
          description: p.description != null ? String(p.description) : '',
          images: this.parseImageList(p.images)
        }
        this.imageList = Array.isArray(this.form.images) ? [...this.form.images] : []
        this.specGroupName = p.spec_group_name != null ? String(p.spec_group_name).trim() : ''
        this.specOptions = this.parseSpecOptions(p.spec_options)
      } catch (e) {
        uni.showToast({ title: '加载商品失败', icon: 'none' })
      }
    },
    onSpecOptionInput(index, e) {
      const value = e && e.detail ? String(e.detail.value || '') : ''
      this.$set ? this.$set(this.specOptions, index, value) : this.specOptions.splice(index, 1, value)
    },
    addSpecOption() {
      this.specOptions.push('')
    },
    removeSpecOption(index) {
      this.specOptions.splice(index, 1)
    },
    normalizeSpecOptions() {
      return this.specOptions.map((item) => String(item || '').trim()).filter(Boolean)
    },
    onCategoryPick(e) {
      const index = Number(e.detail.value)
      const c = this.categories[index]
      this.form.category_id = c ? c.id : null
    },
    removeImage(index) {
      this.imageList.splice(index, 1)
      this.form.images = [...this.imageList]
    },
    chooseAndUploadImage(replaceIndex = -1) {
      if (this.uploading) return
      const token = uni.getStorageSync('token') || ''
      if (!token) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      uni.chooseImage({
        count: 9,
        success: async (chooseRes) => {
          const files = (chooseRes.tempFilePaths || []).filter(Boolean)
          if (!files.length) return
          this.uploading = true
          try {
            for (const filePath of files) {
              const url = await this.uploadSingle(filePath, token)
              if (!url) continue
              if (replaceIndex > -1) {
                this.imageList.splice(replaceIndex, 1, url)
                replaceIndex = -1
              } else {
                this.imageList.push(url)
              }
            }
            this.form.images = [...this.imageList]
            uni.showToast({ title: '上传成功', icon: 'success' })
          } catch (e) {
            uni.showToast({ title: '上传失败', icon: 'none' })
          } finally {
            this.uploading = false
          }
        }
      })
    },
    uploadSingle(filePath, token) {
      return new Promise((resolve, reject) => {
        uni.uploadFile({
          url: API_BASE_URL + '/upload/image',
          filePath,
          name: 'file',
          header: {
            Authorization: 'Bearer ' + token
          },
          success: (uploadRes) => {
            const url = this.parseUploadResponse(uploadRes.data)
            if (!url) {
              reject(new Error('no url'))
              return
            }
            resolve(url)
          },
          fail: reject
        })
      })
    },
    buildPayload() {
      const name = (this.form.name || '').trim()
      const price = Number(this.form.price)
      const originalPriceText = String(this.form.original_price || '').trim()
      const originalPrice = originalPriceText === '' ? null : Number(originalPriceText)
      const category_id = Number(this.form.category_id)
      const description = (this.form.description || '').trim()
      return {
        name,
        price,
        original_price: originalPriceText === '' ? null : originalPrice,
        category_id,
        description,
        images: JSON.stringify(Array.isArray(this.form.images) ? this.form.images : [])
      }
    },
    async saveProduct() {
      const payload = this.buildPayload()
      const spec_group_name = (this.specGroupName || '').trim()
      const spec_options = this.normalizeSpecOptions()
      if (!payload.name) {
        uni.showToast({ title: '请填写商品名称', icon: 'none' })
        return
      }
      if (!Number.isFinite(payload.price) || payload.price <= 0) {
        uni.showToast({ title: '请填写有效售价', icon: 'none' })
        return
      }
      if (payload.original_price != null && (!Number.isFinite(payload.original_price) || payload.original_price < 0)) {
        uni.showToast({ title: '原价格式不正确', icon: 'none' })
        return
      }
      if (!Number.isFinite(payload.category_id) || payload.category_id < 1) {
        uni.showToast({ title: '请选择分类', icon: 'none' })
        return
      }
      if (this.isSupermarket) {
        if (spec_group_name && !spec_options.length) {
          uni.showToast({ title: '请至少填写一个规格项', icon: 'none' })
          return
        }
        if (!spec_group_name && spec_options.length) {
          uni.showToast({ title: '请填写规格组名', icon: 'none' })
          return
        }
        payload.spec_group_name = spec_group_name
        payload.spec_options = spec_options
      }

      this.saving = true
      try {
        await request({
          url: '/merchant/product/' + this.productId,
          method: 'PUT',
          data: payload
        })
        uni.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } finally {
        this.saving = false
      }
    },
    deleteProduct() {
      uni.showModal({
        title: '删除商品',
        content: '确定要删除该商品吗？',
        success: async (res) => {
          if (!res.confirm) return
          this.deleting = true
          try {
            await request({
              url: '/merchant/product/' + this.productId,
              method: 'DELETE'
            })
            uni.showToast({ title: '删除成功', icon: 'success' })
            setTimeout(() => uni.navigateBack(), 600)
          } finally {
            this.deleting = false
          }
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
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.field {
  margin-bottom: 28rpx;
}
.field:last-child {
  margin-bottom: 0;
}
.label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
}
.input {
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
}
.textarea {
  width: 100%;
  min-height: 160rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.picker-line {
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  color: #333;
}
.upload-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.upload-item {
  width: 160rpx;
  height: 160rpx;
  border-radius: 10rpx;
  overflow: hidden;
  position: relative;
}
.upload-item.add {
  border: 2rpx dashed #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-text {
  font-size: 24rpx;
  color: #999;
}
.preview-img {
  width: 100%;
  height: 100%;
}
.remove {
  position: absolute;
  right: 0;
  top: 0;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  font-size: 28rpx;
}
.btn-save {
  margin-top: 8rpx;
}
.spec-options {
  margin-top: 16rpx;
}
.spec-option-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 12rpx;
}
.spec-option-input {
  flex: 1;
}
.spec-add-btn {
  margin-top: 16rpx;
}
.spec-remove-btn {
  flex-shrink: 0;
}
.btn-delete {
  margin-top: 20rpx;
  border: 1rpx solid #ff4d4f;
  color: #ff4d4f;
  background: #fff;
}
</style>
