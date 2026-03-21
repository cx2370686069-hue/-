<template>
  <view class="container">
    <view class="avatar-section">
      <view class="avatar-wrap">
        <text class="avatar-emoji">{{ roleEmoji }}</text>
      </view>
      <text class="avatar-tip">点击更换头像（开发中）</text>
    </view>

    <view class="info-section">
      <view class="info-item" @click="editNickname">
        <text class="info-label">昵称</text>
        <view class="info-right">
          <text class="info-value">{{ nickname }}</text>
          <text class="info-arrow">›</text>
        </view>
      </view>
      <view class="info-item">
        <text class="info-label">手机号</text>
        <view class="info-right">
          <text class="info-value">{{ phone }}</text>
        </view>
      </view>
      <view class="info-item">
        <text class="info-label">身份</text>
        <view class="info-right">
          <text class="role-badge">{{ roleText }}</text>
        </view>
      </view>
      <view class="info-item">
        <text class="info-label">用户ID</text>
        <view class="info-right">
          <text class="info-value">{{ userId }}</text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <view class="info-item" @click="goAddress">
        <text class="info-label">收货地址</text>
        <view class="info-right">
          <text class="info-value">管理</text>
          <text class="info-arrow">›</text>
        </view>
      </view>
      <view class="info-item" @click="goOrders">
        <text class="info-label">我的订单</text>
        <view class="info-right">
          <text class="info-value">查看</text>
          <text class="info-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 修改昵称弹窗 -->
    <view class="modal-mask" v-if="showEditModal" @click="showEditModal = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">修改昵称</text>
        <input class="modal-input" v-model="newNickname" placeholder="请输入新昵称" maxlength="20" focus />
        <view class="modal-actions">
          <view class="modal-btn cancel" @click="showEditModal = false">
            <text class="modal-btn-text cancel-text">取消</text>
          </view>
          <view class="modal-btn confirm" @click="saveNickname">
            <text class="modal-btn-text confirm-text">确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getUserInfo, updateUserInfo } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'
import { ROLE_MAP, ROLE_EMOJI } from '@/config/index.js'

export default {
  data() {
    return {
      nickname: '',
      phone: '',
      role: '',
      userId: '',
      showEditModal: false,
      newNickname: ''
    }
  },
  computed: {
    roleText() {
      return ROLE_MAP[this.role] || '用户'
    },
    roleEmoji() {
      return ROLE_EMOJI[this.role] || '👤'
    }
  },
  onShow() {
    this.loadInfo()
  },
  methods: {
    async loadInfo() {
      try {
        const res = await getUserInfo()
        const info = res.用户信息
        this.nickname = info.昵称
        this.phone = info.手机号
        this.role = info.角色
        this.userId = info.用户ID
      } catch (e) {}
    },
    editNickname() {
      this.newNickname = this.nickname
      this.showEditModal = true
    },
    async saveNickname() {
      const name = this.newNickname.trim()
      if (!name) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' })
        return
      }
      try {
        const res = await updateUserInfo({ nickname: name })
        this.nickname = name
        this.showEditModal = false
        uni.showToast({ title: '修改成功', icon: 'success' })

        const userStore = useUserStore()
        const newInfo = { ...userStore.userInfo, '昵称': name }
        userStore.login(userStore.token, newInfo)
      } catch (e) {}
    },
    goAddress() {
      uni.navigateTo({ url: '/pages/address/index' })
    },
    goOrders() {
      uni.switchTab({ url: '/pages/order/index' })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 40rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
}
.avatar-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 6rpx solid rgba(255,255,255,0.5);
}
.avatar-emoji {
  font-size: 80rpx;
}
.avatar-tip {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 16rpx;
}

.info-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.info-item:last-child {
  border-bottom: none;
}
.info-label {
  font-size: 28rpx;
  color: #333;
}
.info-right {
  display: flex;
  align-items: center;
}
.info-value {
  font-size: 28rpx;
  color: #999;
  margin-right: 8rpx;
}
.info-arrow {
  font-size: 36rpx;
  color: #ccc;
}
.role-badge {
  font-size: 24rpx;
  color: #FF6B35;
  background-color: #FFF3EE;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-content {
  width: 580rpx;
  background-color: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
}
.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  display: block;
  margin-bottom: 30rpx;
}
.modal-input {
  width: 100%;
  border: 2rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  margin-bottom: 30rpx;
}
.modal-actions {
  display: flex;
  gap: 20rpx;
}
.modal-btn {
  flex: 1;
  padding: 20rpx 0;
  border-radius: 40rpx;
  text-align: center;
}
.modal-btn.cancel {
  border: 2rpx solid #ddd;
}
.modal-btn.confirm {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
}
.modal-btn-text {
  font-size: 28rpx;
}
.cancel-text {
  color: #666;
}
.confirm-text {
  color: #fff;
  font-weight: bold;
}
</style>
