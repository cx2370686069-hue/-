<template>
  <view class="container">
    <view class="card form">
      <view class="form-item">
        <text class="label">商品名称 <text class="required">*</text></text>
        <input v-model="form.name" placeholder="请输入商品名称" />
      </view>
      <view class="form-item">
        <text class="label">售价(元) <text class="required">*</text></text>
        <input v-model="form.price" type="digit" placeholder="0.00" />
      </view>
      <view class="form-item">
        <text class="label">库存 <text class="required">*</text></text>
        <input v-model="form.stock" type="number" placeholder="请输入库存数量" />
      </view>
      <view class="form-item">
        <text class="label">商品图片</text>
        <view class="img-upload" @click="chooseImage">
          <image v-if="form.image_url" :src="form.image_url" class="preview" mode="aspectFill" />
          <text v-else class="placeholder">+ 添加图片</text>
        </view>
      </view>
      <view class="form-item status-item">
        <text class="label">上架状态</text>
        <switch :checked="form.status === 1" @change="onStatusChange" color="#FF6B35" />
        <text class="status-text">{{ form.status === 1 ? '上架' : '下架' }}</text>
      </view>
      <button class="btn-primary full" @click="submit">保存</button>
    </view>
  </view>
</template>

<script>
import { createProduct, updateProduct } from '@/api/shop.js'

export default {
  data() {
    return {
      id: '',
      form: {
        name: '',
        price: '',
        stock: '',
        image_url: '',
        status: 1
      }
    }
  },
  onLoad(opt) {
    this.id = opt?.id || ''
    if (this.id) {
      this.loadDetail()
    }
  },
  methods: {
    async loadDetail() {
      try {
        const res = await getProductDetail(this.id)
        const data = res?.data || res || {}
        this.form = {
          name: data.name || '',
          price: data.price ?? '',
          stock: data.stock ?? '',
          image_url: data.image_url || '',
          status: Number(data.status ?? 1)
        }
      } catch (e) {
        uni.showToast({ title: '加载商品详情失败', icon: 'none' })
      }
    },
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.form.image_url = res.tempFilePaths[0]
        }
      })
    },
    async submit() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入商品名称', icon: 'none' })
        return
      }
      if (!this.form.price || Number(this.form.price) <= 0) {
        uni.showToast({ title: '请输入正确的售价', icon: 'none' })
        return
      }
      if (this.form.stock === '' || Number(this.form.stock) < 0) {
        uni.showToast({ title: '请输入正确的库存', icon: 'none' })
        return
      }

      const payload = {
        name: this.form.name.trim(),
        price: Number(this.form.price),
        stock: Number(this.form.stock),
        status: Number(this.form.status),
        image_url: this.form.image_url || '',
        description: '暂无描述',
        category_id: 1
      }

      try {
        if (this.id) {
          await updateProduct(this.id, payload)
          uni.showToast({ title: '修改成功', icon: 'success' })
        } else {
          await createProduct(payload)
          uni.showToast({ title: '添加成功', icon: 'success' })
        }
        setTimeout(() => uni.navigateBack(), 1500)
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.form-item { margin-bottom: 32rpx; }
.label { display: block; font-size: 28rpx; margin-bottom: 12rpx; color: #666; }
.required { color: #f44336; }
input {
  width: 100%;
  padding: 24rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.img-upload {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview { width: 100%; height: 100%; border-radius: 12rpx; }
.placeholder { color: #999; font-size: 24rpx; }
.full { width: 100%; margin-top: 24rpx; }
.status-item { display: flex; align-items: center; gap: 16rpx; }
.status-text { font-size: 28rpx; color: #666; }
</style>
