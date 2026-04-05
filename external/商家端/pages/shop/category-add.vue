<template>
  <view class="page">
    <view class="field">
      <text class="label">分类名称</text>
      <input class="input" v-model="name" placeholder="请输入分类名称" />
    </view>
    <button class="btn" type="primary" :loading="loading" @click="submit">提交</button>
  </view>
</template>

<script>
import { createCategory } from '@/api/shop.js'

export default {
  data() {
    return {
      name: '',
      loading: false
    }
  },
  methods: {
    async submit() {
      const name = (this.name || '').trim()
      if (!name) {
        uni.showToast({ title: '请输入分类名称', icon: 'none' })
        return
      }
      this.loading = true
      try {
        await createCategory({ name, sort: 1 })
        uni.showToast({ title: '已添加', icon: 'success' })
        this.name = ''
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        // request 已提示
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f5f5f5;
  box-sizing: border-box;
}
.field {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
}
.label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 16rpx;
}
.input {
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 20rpx;
  font-size: 28rpx;
}
.btn {
  margin-top: 16rpx;
}
</style>
