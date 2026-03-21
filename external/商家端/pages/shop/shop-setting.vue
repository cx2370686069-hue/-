<template>
  <view class="container">
    <view class="shop-header">
      <view class="shop-avatar">
        <text class="avatar-text">{{ shopInfo.店铺名称?.slice(0, 1) || '店' }}</text>
      </view>
      <view class="shop-name">{{ shopInfo.店铺名称 || '我的店铺' }}</view>
    </view>

    <view class="form-section">
      <view class="section-title">基本信息</view>
      
      <view class="form-item">
        <text class="form-label">店铺名称</text>
        <input 
          class="form-input" 
          v-model="shopInfo.店铺名称" 
          placeholder="请输入店铺名称"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">联系电话</text>
        <input 
          class="form-input" 
          v-model="shopInfo.联系电话" 
          type="number"
          placeholder="请输入联系电话"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">店铺地址</text>
        <input 
          class="form-input" 
          v-model="shopInfo.店铺地址" 
          placeholder="请输入店铺地址"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">营业时间</text>
        <view class="time-range">
          <picker mode="time" :value="shopInfo.营业时间开始" @change="onStartTimeChange">
            <view class="time-picker">{{ shopInfo.营业时间开始 || '00:00' }}</view>
          </picker>
          <text class="time-separator">-</text>
          <picker mode="time" :value="shopInfo.营业时间结束" @change="onEndTimeChange">
            <view class="time-picker">{{ shopInfo.营业时间结束 || '23:59' }}</view>
          </picker>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">店铺公告</text>
        <textarea 
          class="form-textarea" 
          v-model="shopInfo.公告" 
          placeholder="请输入店铺公告"
          placeholder-class="input-placeholder"
          maxlength="200"
        />
      </view>
    </view>

    <view class="form-section">
      <view class="section-title">配送设置</view>
      
      <view class="form-item">
        <text class="form-label">配送范围</text>
        <input 
          class="form-input" 
          v-model="shopInfo.配送范围" 
          type="digit"
          placeholder="请输入配送范围（公里）"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">配送费</text>
        <input 
          class="form-input" 
          v-model="shopInfo.配送费" 
          type="digit"
          placeholder="请输入配送费"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">起送价</text>
        <input 
          class="form-input" 
          v-model="shopInfo.起送价" 
          type="digit"
          placeholder="请输入起送价"
          placeholder-class="input-placeholder"
        />
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">
      <text class="submit-btn-text">保存设置</text>
    </view>
  </view>
</template>

<script>
import { getShopInfo, updateShopInfo } from '@/api/shop.js'

export default {
  data() {
    return {
      shopInfo: {
        店铺名称： '',
        联系电话： '',
        店铺地址： '',
        营业时间开始： '00:00',
        营业时间结束： '23:59',
        公告： '',
        配送范围： '',
        配送费： '',
        起送价： ''
      }
    }
  },
  onLoad() {
    this.loadShopInfo()
  },
  methods: {
    async loadShopInfo() {
      try {
        const res = await getShopInfo()
        if (res) {
          this.shopInfo = {
            店铺名称：res.店铺名称 || '',
            联系电话：res.联系电话 || '',
            店铺地址：res.店铺地址 || '',
            营业时间开始：res.营业时间开始 || '00:00',
            营业时间结束：res.营业时间结束 || '23:59',
            公告：res.公告 || '',
            配送范围：res.配送范围 || '',
            配送费：res.配送费 || '',
            起送价：res.起送价 || ''
          }
        }
      } catch (e) {
        console.log('加载店铺信息失败', e)
      }
    },
    onStartTimeChange(e) {
      this.shopInfo.营业时间开始 = e.detail.value
    },
    onEndTimeChange(e) {
      this.shopInfo.营业时间结束 = e.detail.value
    },
    async handleSubmit() {
      if (!this.shopInfo.店铺名称) {
        uni.showToast({
          title: '请输入店铺名称',
          icon: 'none'
        })
        return
      }

      try {
        await updateShopInfo(this.shopInfo)
        uni.showToast({
          title: '保存成功',
          icon: 'success'
        })
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (e) {
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #F5F5F5;
  padding: 20rpx;
  padding-bottom: 140rpx;
}

.shop-header {
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  padding: 40rpx;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
}

.shop-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.avatar-text {
  font-size: 60rpx;
  font-weight: bold;
  color: #FF6B35;
}

.shop-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.form-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.form-item {
  padding: 30rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 80rpx;
  font-size: 28rpx;
  color: #333;
}

.input-placeholder {
  color: #999;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  font-size: 28rpx;
  color: #333;
}

.time-range {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.time-picker {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #333;
}

.time-separator {
  padding: 0 20rpx;
  color: #999;
}

.submit-btn {
  position: fixed;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 600rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.4);
}

.submit-btn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}
</style>
