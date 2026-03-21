<template>
  <view class="container">
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="nav-back">‹</text>
        <text class="nav-back-text">返回</text>
      </view>
      <text class="nav-title">我要卖手机</text>
    </view>

    <view class="content">
      <view class="tip-box">
        <text class="tip-text">填写手机信息，提交后我们将尽快为您估价</text>
      </view>

      <view class="form-section">
        <view class="form-item">
          <text class="form-label">手机品牌</text>
          <input class="form-input" v-model="form.brand" placeholder="如：苹果、华为、小米" />
        </view>
        <view class="form-item">
          <text class="form-label">手机型号</text>
          <input class="form-input" v-model="form.model" placeholder="如：iPhone 14、Mate 60" />
        </view>
        <view class="form-item">
          <text class="form-label">成色</text>
          <picker :range="conditionList" @change="onConditionChange" :value="conditionIndex">
            <view class="picker-value">
              <text :class="form.condition ? 'picker-text' : 'picker-placeholder'">{{ form.condition || '请选择成色' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">内存容量</text>
          <picker :range="storageList" @change="onStorageChange" :value="storageIndex">
            <view class="picker-value">
              <text :class="form.storage ? 'picker-text' : 'picker-placeholder'">{{ form.storage || '请选择' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">其他说明</text>
          <textarea class="form-textarea" v-model="form.remark" placeholder="屏幕、电池、维修史等（选填）" />
        </view>
        <view class="form-item">
          <text class="form-label">联系电话</text>
          <input class="form-input" v-model="form.phone" placeholder="便于联系您估价" type="number" />
        </view>
      </view>

      <view class="submit-wrap">
        <view class="submit-btn" @click="handleSubmit">
          <text class="submit-btn-text">提交估价</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      form: {
        brand: '',
        model: '',
        condition: '全新',
        storage: '64G',
        remark: '',
        phone: ''
      },
      conditionList: ['全新', '几乎全新', '轻微使用痕迹', '明显使用痕迹', '有磕碰/划痕'],
      conditionIndex: 0,
      storageList: ['64G', '128G', '256G', '512G', '1T'],
      storageIndex: 0
    }
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    onConditionChange(e) {
      this.conditionIndex = e.detail.value
      this.form.condition = this.conditionList[e.detail.value]
    },
    onStorageChange(e) {
      this.storageIndex = e.detail.value
      this.form.storage = this.storageList[e.detail.value]
    },
    handleSubmit() {
      if (!this.form.brand.trim()) {
        uni.showToast({ title: '请填写手机品牌', icon: 'none' })
        return
      }
      if (!this.form.model.trim()) {
        uni.showToast({ title: '请填写手机型号', icon: 'none' })
        return
      }
      if (!this.form.condition) {
        uni.showToast({ title: '请选择成色', icon: 'none' })
        return
      }
      if (!this.form.storage) {
        uni.showToast({ title: '请选择内存容量', icon: 'none' })
        return
      }
      if (!this.form.phone.trim()) {
        uni.showToast({ title: '请填写联系电话', icon: 'none' })
        return
      }
      uni.showToast({ title: '提交成功，我们会尽快联系您估价', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }
  }
}
</script>

<style scoped>
.container {
  background: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 40rpx;
}

.nav-bar {
  width: 100%;
  padding: 44rpx 28rpx 36rpx;
  padding-left: 24rpx;
  padding-top: calc(44rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.nav-left {
  display: flex;
  align-items: center;
  padding-top: 32rpx;
  margin-right: 24rpx;
}
.nav-back {
  font-size: 64rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
  margin-right: 10rpx;
}
.nav-back-text {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}
.nav-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  padding-top: 32rpx;
}

.content {
  padding: 24rpx;
}
.tip-box {
  background: #FFF8F0;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.tip-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.form-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.form-item {
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.form-item:last-child {
  border-bottom: none;
}
.form-label {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}
.form-textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}
.picker-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.picker-text {
  font-size: 28rpx;
  color: #333;
}
.picker-placeholder {
  font-size: 28rpx;
  color: #999;
}
.picker-arrow {
  font-size: 32rpx;
  color: #ccc;
}

.submit-wrap {
  margin-top: 48rpx;
  padding: 0 10rpx;
}
.submit-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 28rpx 0;
  text-align: center;
}
.submit-btn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}
</style>
