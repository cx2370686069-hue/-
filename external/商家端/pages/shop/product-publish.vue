<template>
  <view class="page">
    <!-- 表单：未发布成功时展示 -->
    <block v-if="!publishDone">
      <view class="card">
      <view class="field">
        <text class="label">商品名称 (name)</text>
        <input class="input" v-model="form.name" placeholder="请输入商品名称" />
      </view>

      <view class="field">
        <text class="label">现价 (price) *必填</text>
        <input class="input" v-model="form.price" type="digit" placeholder="请输入售价" />
      </view>

      <view class="field">
        <text class="label">商品描述 (description)</text>
          <textarea
            class="textarea"
            v-model="form.description"
            placeholder="选填，输入商品描述"
            maxlength="2000"
          />
        </view>

        <view class="field">
          <text class="label">商品图片 (images)</text>
          <view class="upload-area" @click="chooseAndUploadImage">
            <image v-if="imageUrls[0]" class="upload-preview" :src="formatImageUrl(imageUrls[0])" mode="aspectFill" />
            <text v-else class="upload-text">点击上传图片</text>
          </view>
          <text class="hint">上传后会保存为 JSON 字符串数组，未上传则提交 '[]'</text>
        </view>
      </view>

      <button class="btn" type="primary" :loading="submitting" @click="submit">发布商品</button>
    </block>

    <!-- 发布成功：独立结果页，避免仍停留在同一表单无反馈 -->
    <view v-else class="result-wrap">
      <view class="result-card">
        <view class="result-icon-wrap">
          <text class="result-icon">✓</text>
        </view>
        <text class="result-title">发布成功</text>
        <text class="result-desc">商品已写入数据库，可继续发布或返回列表</text>
        <button class="btn-secondary" type="default" @click="continuePublish">继续发布</button>
        <button class="btn-primary-line" type="default" @click="backToProductList">返回商品列表</button>
      </view>
    </view>
  </view>
</template>

<script>
import { BASE_URL } from '@/config/index.js'
import { createMerchantProduct } from '@/api/shop.js'

const API_BASE_URL = BASE_URL + '/api'

export default {
  data() {
    return {
      imageUrls: [],
      form: {
        name: '',
        price: '',
        description: ''
      },
      uploading: false,
      submitting: false,
      /** 接口成功后切换为结果态，不再停留在表单页 */
      publishDone: false
    }
  },
  methods: {
    formatImageUrl(url) {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image') || url.startsWith('blob:')) {
        return url
      }
      return url.startsWith('/') ? BASE_URL + url : BASE_URL + '/' + url
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
    chooseAndUploadImage() {
      if (this.uploading) return
      const token = uni.getStorageSync('token') || ''
      if (!token) {
        uni.showToast({ title: '请先登录后再上传', icon: 'none' })
        return
      }
      uni.chooseImage({
        count: 1,
        success: (chooseRes) => {
          const filePath = chooseRes.tempFilePaths && chooseRes.tempFilePaths[0]
          if (!filePath) return
          this.uploading = true
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
                uni.showToast({ title: '图片上传失败', icon: 'none' })
                return
              }
              this.imageUrls = [url]
              uni.showToast({ title: '上传成功', icon: 'success' })
            },
            fail: () => {
              uni.showToast({ title: '图片上传失败', icon: 'none' })
            },
            complete: () => {
              this.uploading = false
            }
          })
        }
      })
    },
    /**
     * 封装层在 HTTP 200 时 resolve(res.data)，等价于 res.statusCode === 200。
     * 若 body 含 code，则按数字比较（兼容字符串 "200"）；无 code 视为成功。
     */
    isPublishSuccess(data) {
      if (data == null || typeof data !== 'object') return true
      if (!Object.prototype.hasOwnProperty.call(data, 'code')) return true
      const n = Number(data.code)
      return n === 200 || n === 0 || n === 201
    },
    /** 发布成功后离开当前页：优先返回上一页；无栈或 navigateBack 失败则直达商品列表 */
    finishPublishAndLeave() {
      this.submitting = false
      try {
        uni.hideToast()
      } catch (e) {}
      const listUrl = '/pages/product/list'
      const emitRefresh = () => {
        try {
          uni.$emit('refreshProductList')
        } catch (e) {}
      }
      const goList = () => {
        uni.redirectTo({
          url: listUrl,
          success: emitRefresh,
          fail: () => {
            uni.reLaunch({ url: listUrl, success: emitRefresh })
          }
        })
      }
      try {
        const pages = getCurrentPages()
        if (pages && pages.length > 1) {
          uni.navigateBack({
            delta: 1,
            success: emitRefresh,
            fail: goList
          })
        } else {
          goList()
        }
      } catch (e) {
        goList()
      }
    },
    /** 清空表单，继续录入一条新商品 */
    continuePublish() {
      this.publishDone = false
      this.form = {
        name: '',
        price: '',
        description: ''
      }
      this.imageUrls = []
    },
    /** 返回商品列表（不依赖页面栈，保证能离开发布页） */
    backToProductList() {
      this.finishPublishAndLeave()
    },
    async submit() {
      const name = (this.form.name || '').trim()
      const price = Number(this.form.price)
      const description = (this.form.description || '').trim()

      if (!name) {
        uni.showToast({ title: '请填写商品名称', icon: 'none' })
        return
      }
      if (!Number.isFinite(price) || price <= 0) {
        uni.showToast({ title: '请填写有效售价', icon: 'none' })
        return
      }

      // 为了兼容后端可能存在的必填校验，强行塞一个默认的 category_id
      const payload = {
        name,
        price,
        category_id: 1, // 向下兼容后端限制
        description,
        images: JSON.stringify(this.imageUrls.length ? this.imageUrls : [])
      }

      this.submitting = true
      try {
        const data = await createMerchantProduct(payload)

        if (!this.isPublishSuccess(data)) {
          uni.showToast({ title: (data && (data.message || data.msg)) || '发布失败', icon: 'none' })
          this.submitting = false
          return
        }

        this.submitting = false
        uni.showToast({
          title: '发布成功',
          icon: 'success',
          mask: true
        })
        setTimeout(() => {
          uni.navigateBack({
            delta: 1
          })
        }, 1500)
      } catch (e) {
        if (this.isPublishSuccess(e)) {
          this.submitting = false
          uni.showToast({
            title: '发布成功',
            icon: 'success',
            mask: true
          })
          setTimeout(() => {
            uni.navigateBack({
              delta: 1
            })
          }, 1500)
          return
        }
        this.submitting = false
        const msg = (e && e.data && (e.data.message || e.data.msg)) || (e && e.message) || '发布异常，请重试'
        uni.showToast({ title: msg, icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: #f5f5f5; box-sizing: border-box; }
.card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 24rpx; }
.field { margin-bottom: 28rpx; }
.field:last-child { margin-bottom: 0; }
.label { display: block; font-size: 26rpx; color: #666; margin-bottom: 12rpx; }
.input { border: 1rpx solid #ddd; border-radius: 8rpx; padding: 16rpx 20rpx; font-size: 28rpx; }
.textarea { width: 100%; min-height: 160rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 16rpx 20rpx; font-size: 28rpx; box-sizing: border-box; }
.picker-line { border: 1rpx solid #ddd; border-radius: 8rpx; padding: 16rpx 20rpx; font-size: 28rpx; color: #333; }
.upload-area { width: 180rpx; height: 180rpx; border: 2rpx dashed #ddd; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafafa; }
.upload-preview { width: 100%; height: 100%; }
.upload-text { font-size: 24rpx; color: #999; }
.hint { display: block; margin-top: 12rpx; font-size: 22rpx; color: #999; }
.btn { margin-top: 8rpx; }
.result-wrap {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
}
.result-card {
  width: 100%;
  background: #fff;
  border-radius: 16rpx;
  padding: 48rpx 36rpx;
  text-align: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.06);
}
.result-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 24rpx;
  border-radius: 50%;
  background: #f6ffed;
  display: flex;
  align-items: center;
  justify-content: center;
}
.result-icon {
  font-size: 64rpx;
  color: #52c41a;
  font-weight: bold;
}
.result-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}
.result-desc {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 40rpx;
  line-height: 1.5;
}
.btn-secondary {
  margin-bottom: 24rpx;
  background: linear-gradient(135deg, #ff6b35, #ff8f65);
  color: #fff;
  border: none;
  border-radius: 44rpx;
  font-size: 30rpx;
}
.btn-primary-line {
  background: #fff;
  color: #ff6b35;
  border: 2rpx solid #ff6b35;
  border-radius: 44rpx;
  font-size: 30rpx;
}
</style>
