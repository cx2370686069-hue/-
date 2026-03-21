<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
      <text class="nav-title">我要报修</text>
    </view>
    <view class="form-wrap">
      <view class="form-item">
        <text class="label">家电类型</text>
        <picker mode="selector" :range="types" :value="typeIndex" @change="onTypeChange">
          <view class="picker-val">{{ types[typeIndex] }}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="label">故障描述</text>
        <textarea class="textarea" v-model="form.desc" placeholder="请简要描述故障现象" />
      </view>
      <view class="form-item">
        <text class="label">联系地址</text>
        <input class="input" v-model="form.address" placeholder="请填写详细地址" />
      </view>
      <view class="form-item">
        <text class="label">联系电话</text>
        <input class="input" v-model="form.phone" type="number" placeholder="请填写联系电话" />
      </view>
      <view class="submit-btn" @click="submit">提交报修</view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      types: ['空调', '冰箱', '洗衣机', '电视', '热水器', '其他'],
      typeIndex: 0,
      form: { desc: '', address: '', phone: '' }
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    onTypeChange(e) {
      this.typeIndex = e.detail.value
    },
    submit() {
      if (!this.form.desc.trim()) {
        uni.showToast({ title: '请填写故障描述', icon: 'none' })
        return
      }
      if (!this.form.phone.trim()) {
        uni.showToast({ title: '请填写联系电话', icon: 'none' })
        return
      }
      uni.showToast({ title: '提交成功，师傅将尽快联系您', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1500)
    }
  }
}
</script>

<style scoped>
.container { background: #f5f5f5; min-height: 100vh; padding-bottom: 40rpx; }
.nav-bar {
  padding-top: calc(44rpx + env(safe-area-inset-top));
  padding-bottom: 24rpx;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  display: flex;
  align-items: center;
}
.nav-left { display: flex; align-items: center; }
.nav-back { font-size: 48rpx; color: #fff; font-weight: 300; margin-right: 10rpx; }
.nav-back-text { font-size: 36rpx; font-weight: bold; color: #fff; }
.nav-title { font-size: 36rpx; font-weight: bold; color: #fff; margin-left: 20rpx; }

.form-wrap { padding: 24rpx; }
.form-item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.label { display: block; font-size: 28rpx; color: #333; margin-bottom: 16rpx; }
.input, .picker-val { font-size: 28rpx; color: #333; }
.textarea { width: 100%; min-height: 160rpx; font-size: 28rpx; color: #333; }
.submit-btn {
  margin-top: 40rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  padding: 28rpx;
  border-radius: 44rpx;
}
</style>
