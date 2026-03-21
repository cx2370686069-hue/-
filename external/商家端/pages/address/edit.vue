<template>
  <view class="container">
    <view class="form-section">
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input class="form-input" v-model="name" placeholder="请输入收货人姓名" />
      </view>
      <view class="form-item">
        <text class="form-label">联系电话</text>
        <input class="form-input" v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <input class="form-input" v-model="address" placeholder="如：城关镇中山大街1号" />
      </view>
      <view class="form-item switch-item">
        <text class="form-label">设为默认地址</text>
        <switch :checked="isDefault" @change="onSwitchChange" color="#FF6B35" />
      </view>
    </view>

    <view class="save-bar">
      <view class="save-btn" @click="save">
        <text class="save-btn-text">{{ isEdit ? '保存修改' : '保存地址' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { addAddress, updateAddress } from '@/api/address.js'
import { isValidPhone, isNotEmpty } from '@/utils/validate.js'

export default {
  data() {
    return {
      addrId: 0,
      name: '',
      phone: '',
      address: '',
      isDefault: false,
      isEdit: false
    }
  },
  onLoad(options) {
    if (options.id && options.data) {
      this.isEdit = true
      this.addrId = parseInt(options.id)
      const data = JSON.parse(decodeURIComponent(options.data))
      this.name = data.收货人
      this.phone = data.联系电话
      this.address = data.详细地址
      this.isDefault = data.是否默认 === 1
      uni.setNavigationBarTitle({ title: '编辑地址' })
    } else {
      uni.setNavigationBarTitle({ title: '新增地址' })
    }
  },
  methods: {
    onSwitchChange(e) {
      this.isDefault = e.detail.value
    },
    async save() {
      if (!isNotEmpty(this.name)) {
        uni.showToast({ title: '请输入收货人姓名', icon: 'none' })
        return
      }
      if (!isValidPhone(this.phone)) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
      }
      if (!isNotEmpty(this.address)) {
        uni.showToast({ title: '请输入详细地址', icon: 'none' })
        return
      }

      const data = {
        name: this.name.trim(),
        phone: this.phone,
        address: this.address.trim(),
        isDefault: this.isDefault
      }

      try {
        if (this.isEdit) {
          await updateAddress(this.addrId, data)
          uni.showToast({ title: '修改成功', icon: 'success' })
        } else {
          await addAddress(data)
          uni.showToast({ title: '添加成功', icon: 'success' })
        }
        setTimeout(() => {
          uni.navigateBack()
        }, 1000)
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 140rpx;
}
.form-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 10rpx 24rpx;
}
.form-item {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.form-item:last-child {
  border-bottom: none;
}
.form-label {
  font-size: 28rpx;
  color: #333;
  width: 160rpx;
  flex-shrink: 0;
}
.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}
.switch-item {
  justify-content: space-between;
}

.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  background-color: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
}
.save-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 24rpx 0;
  text-align: center;
}
.save-btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}
</style>
