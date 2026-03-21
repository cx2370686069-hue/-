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
        <text class="label">营业时间</text>
        <input v-model="form.businessHours" placeholder="如：9:00-21:00" />
      </view>
      <view class="form-item">
        <text class="label">店铺简介</text>
        <textarea v-model="form.intro" placeholder="请输入店铺简介" />
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
        businessHours: '',
        intro: '',
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
        this.form = { ...this.form, ...res?.data };
      } catch (e) {
        this.form = {
          name: '固始县外卖商家',
          phone: '13800138000',
          address: '固始县XX路XX号',
          businessHours: '9:00-21:00',
          intro: '欢迎光临',
          status: 1
        };
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
      try {
        await updateShopInfo(this.form);
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
