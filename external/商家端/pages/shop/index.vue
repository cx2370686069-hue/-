<template>
  <view class="container">
    <view class="card">
      <view class="form-item">
        <text class="label">店铺名称</text>
        <input v-model="form.name" placeholder="请输入店铺名称" />
      </view>
      <view class="form-item">
        <text class="label">联系电话</text>
        <input v-model="form.phone" type="number" placeholder="请输入联系电话" />
      </view>
      <view class="form-item">
        <text class="label">店铺地址</text>
        <input v-model="form.address" placeholder="请输入店铺地址" />
      </view>
      <view class="form-item">
        <text class="label">纬度</text>
        <input v-model="form.latitude" type="digit" placeholder="如：32.18" />
      </view>
      <view class="form-item">
        <text class="label">经度</text>
        <input v-model="form.longitude" type="digit" placeholder="如：115.68" />
      </view>
      <view class="form-item">
        <text class="label">营业状态</text>
        <switch :checked="form.status === 1" @change="onStatusChange" color="#FF6B35" />
        <text class="status-text">{{ form.status === 1 ? '营业中' : '休息中' }}</text>
      </view>
      <button class="btn-primary full" @click="submit">保存</button>
    </view>
  </view>
</template>

<script>
import { getShopInfo, updateShopInfo } from '../../api/index.js';

export default {
  data() {
    return {
      form: {
        name: '',
        phone: '',
        address: '',
        latitude: '',
        longitude: '',
        status: 1
      }
    };
  },
  onLoad() {
    this.loadInfo();
  },
  methods: {
    async loadInfo() {
      try {
        const res = await getShopInfo();
        const data = res?.data || res || {};
        this.form = {
          ...this.form,
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          latitude: data.latitude ?? '',
          longitude: data.longitude ?? '',
          status: Number(data.status ?? 1)
        };
      } catch (e) {
        uni.showToast({ title: '加载店铺信息失败', icon: 'none' });
      }
    },
    onStatusChange(e) {
      this.form.status = e.detail.value ? 1 : 0;
    },
    async submit() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入店铺名称', icon: 'none' });
        return;
      }
      if (!this.form.phone.trim()) {
        uni.showToast({ title: '请输入联系电话', icon: 'none' });
        return;
      }
      if (!this.form.address.trim()) {
        uni.showToast({ title: '请输入详细地址', icon: 'none' });
        return;
      }
      try {
        await updateShopInfo({
          name: this.form.name.trim(),
          phone: this.form.phone.trim(),
          address: this.form.address.trim(),
          latitude: Number(this.form.latitude || 0),
          longitude: Number(this.form.longitude || 0),
          status: Number(this.form.status)
        });
        uni.showToast({ title: '保存成功' });
      } catch (e) {}
    }
  }
};
</script>

<style scoped>
.form-item { margin-bottom: 32rpx; }
.label { display: block; font-size: 28rpx; margin-bottom: 12rpx; color: #666; }
input, textarea {
  width: 100%;
  padding: 24rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
textarea { min-height: 120rpx; }
.status-text { margin-left: 16rpx; font-size: 28rpx; }
.full { width: 100%; margin-top: 24rpx; }
</style>
