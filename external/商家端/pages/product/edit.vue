<template>
  <view class="container">
    <view class="card form">
      <view class="form-item">
        <text class="label">商品名称 <text class="required">*</text></text>
        <input v-model="form.name" placeholder="请输入商品名称" />
      </view>
      <view class="form-item">
        <text class="label">商品价格(元) <text class="required">*</text></text>
        <input v-model="form.price" type="digit" placeholder="0.00" />
      </view>
      <view class="form-item">
        <text class="label">库存数量 <text class="required">*</text></text>
        <input v-model="form.stock" type="number" placeholder="默认100" />
      </view>
      <view class="form-item">
        <text class="label">商品图片</text>
        <input v-model="form.image" placeholder="请输入图片URL（选填）" />
      </view>
      <view class="form-item">
        <text class="label">商品描述</text>
        <textarea v-model="form.description" placeholder="请输入商品描述（选填）" />
      </view>
      <view class="form-item status-item">
        <text class="label">是否上架</text>
        <switch :checked="form.status === 1" @change="onStatusChange" color="#FF6B35" />
        <text class="status-text">{{ form.status === 1 ? '上架' : '下架' }}</text>
      </view>
      <button class="btn-primary full" @click="submit">保存</button>
    </view>
  </view>
</template>

<script>
import { createProduct } from '@/api/shop.js'

export default {
  data() {
    return {
      form: {
        name: '',
        price: '',
        stock: 100,
        image: '',
        description: '',
        status: 1
      }
    }
  },
  methods: {
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0
    },
    async submit() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入商品名称', icon: 'none' })
        return
      }
      if (!this.form.price || Number(this.form.price) <= 0) {
        uni.showToast({ title: '请输入正确的价格', icon: 'none' })
        return
      }
      if (!this.form.stock || Number(this.form.stock) < 0) {
        uni.showToast({ title: '请输入正确的库存', icon: 'none' })
        return
      }

      const payload = {
        name: this.form.name.trim(),
        price: Number(this.form.price),
        stock: Number(this.form.stock),
        image: this.form.image || '',
        description: this.form.description || '',
        status: Number(this.form.status)
      }

      try {
        const res = await createProduct(payload)
        uni.showToast({ title: '添加成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 1500)
      } catch (e) {
        uni.showToast({ title: '添加失败', icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.container {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20rpx;
}
.card {
  position: relative;
  z-index: 2;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
}
.form-item {
  position: relative;
  z-index: 10;
  margin-bottom: 32rpx;
}
.label {
  display: block;
  font-size: 28rpx;
  margin-bottom: 12rpx;
  color: #666;
}
.required {
  color: #f44336;
}
input {
  width: 100%;
  padding: 24rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  background-color: #fff;
  pointer-events: auto !important;
  position: relative;
  z-index: 11;
}
textarea {
  width: 100%;
  padding: 24rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  font-size: 28rpx;
  min-height: 120rpx;
  box-sizing: border-box;
  background-color: #fff;
  pointer-events: auto !important;
  position: relative;
  z-index: 11;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.status-text {
  font-size: 28rpx;
  color: #666;
}
.full {
  width: 100%;
  margin-top: 24rpx;
  position: relative;
  z-index: 10;
}
</style>
