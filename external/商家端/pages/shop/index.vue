<template>
  <view class="container">
    <view class="header">
      <text class="title">{{ isCreateMode ? '创建店铺' : '商家管理' }}</text>
    </view>

    <view class="form-group">
      <view class="form-item">
        <text class="label">店铺名称</text>
        <input class="input" type="text" v-model="form.name" placeholder="请输入店铺名称" />
      </view>

      <view class="form-item">
        <text class="label">联系电话</text>
        <input class="input" type="number" v-model="form.phone" placeholder="请输入联系电话" />
      </view>

      <view class="form-item">
        <text class="label">店铺地址</text>
        <input class="input" type="text" v-model="form.address" placeholder="请输入店铺地址" />
      </view>

      <view class="form-item">
        <text class="label">纬度</text>
        <input class="input" type="digit" v-model="form.latitude" placeholder="如：32.18" />
      </view>

      <view class="form-item">
        <text class="label">经度</text>
        <input class="input" type="digit" v-model="form.longitude" placeholder="如：115.68" />
      </view>

      <view class="form-item" v-if="!isCreateMode">
        <text class="label">营业状态</text>
        <switch :checked="form.status === 1" @change="onStatusChange" color="#ff6b00" />
        <text class="status-text">{{ form.status === 1 ? '营业中' : '休息中' }}</text>
      </view>
    </view>

    <button class="save-btn" @click="submitForm">{{ isCreateMode ? '立即创建' : '保存修改' }}</button>
  </view>
</template>

<script>
import { getShopInfo, createShop, updateShopInfo } from '@/api/shop.js'

export default {
  data() {
    return {
      isCreateMode: false, // 是否为创建模式
      form: {
        name: '',
        phone: '',
        address: '',
        latitude: '',
        longitude: '',
        status: 1
      }
    }
  },
  onLoad() {
    this.loadShopData()
  },
  methods: {
    // 加载店铺数据
    async loadShopData() {
      try {
        const res = await getShopInfo()
        if (res.code === 200 && res.data) {
          // 有店铺，进入修改模式
          this.isCreateMode = false
          this.form = {
            name: res.data.name || '',
            phone: res.data.phone || '',
            address: res.data.address || '',
            latitude: res.data.latitude || '',
            longitude: res.data.longitude || '',
            status: res.data.status
          }
        } else {
          // 没有店铺，进入创建模式
          this.isCreateMode = true
        }
      } catch (e) {
        // 如果后端返回 404 错误，说明没店铺，不要弹窗报错，直接进入创建模式
        console.log('未获取到店铺，进入创建模式')
        this.isCreateMode = true
      }
    },

    // 切换营业状态
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0
    },

    // 提交表单
    async submitForm() {
      if (!this.form.name || !this.form.phone || !this.form.address) {
        uni.showToast({ title: '请填写完整信息', icon: 'none' })
        return
      }

      const payload = {
        name: this.form.name,
        phone: this.form.phone,
        address: this.form.address,
        latitude: Number(this.form.latitude) || 32.18,
        longitude: Number(this.form.longitude) || 115.68,
        status: this.form.status,
        description: '暂无描述',
        min_price: 0,
        delivery_fee: 0,
        delivery_radius: 5
      }

      try {
        if (this.isCreateMode) {
          const res = await createShop(payload)
          if (res.code === 200 || res.code === 201) {
            uni.showToast({ title: '创建成功', icon: 'success' })
            this.isCreateMode = false
          }
        } else {
          const res = await updateShopInfo(payload)
          if (res.code === 200) {
            uni.showToast({ title: '保存成功', icon: 'success' })
          }
        }
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  }
}
</script>

<style>
.container {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.header {
  background-color: #ff6b00;
  padding: 30rpx;
  text-align: center;
  border-radius: 10rpx 10rpx 0 0;
  margin-bottom: 20rpx;
}
.title {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}
.form-group {
  background-color: #fff;
  border-radius: 10rpx;
  padding: 0 20rpx;
}
.form-item {
  display: flex;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1px solid #eee;
}
.form-item:last-child {
  border-bottom: none;
}
.label {
  width: 160rpx;
  font-size: 28rpx;
  color: #333;
}
.input {
  flex: 1;
  font-size: 28rpx;
}
.status-text {
  margin-left: 20rpx;
  font-size: 28rpx;
  color: #666;
}
.save-btn {
  margin-top: 60rpx;
  background-color: #ff6b00;
  color: #fff;
  font-size: 32rpx;
  border-radius: 40rpx;
}
</style>