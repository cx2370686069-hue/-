<template>
  <view class="container">
    <view class="logo-area">
      <text class="logo-emoji">🛵</text>
      <text class="logo-title">固始县外卖</text>
      <text class="logo-sub">乡镇外卖 · 跑腿 · 生活服务</text>
    </view>

    <view class="form-card">
      <view class="tab-bar">
        <text :class="['tab-item', !isRegister && 'tab-active']" @click="isRegister = false">登录</text>
        <text :class="['tab-item', isRegister && 'tab-active']" @click="isRegister = true">注册</text>
      </view>

      <view class="input-group">
        <text class="input-icon">📱</text>
        <input class="input" v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>

      <view class="input-group">
        <text class="input-icon">🔒</text>
        <input class="input" v-model="password" placeholder="请输入密码" password />
      </view>

      <view v-if="isRegister">
        <view class="input-group">
          <text class="input-icon">😊</text>
          <input class="input" v-model="nickname" placeholder="昵称（选填）" />
        </view>

        <view class="role-section">
          <text class="role-label">选择身份：</text>
          <view class="role-list">
            <text :class="['role-tag', role === 'user' && 'role-tag-active']" @click="role = 'user'">👤 用户</text>
            <text :class="['role-tag', role === 'shop' && 'role-tag-active']" @click="role = 'shop'">🏪 商家</text>
            <text :class="['role-tag', role === 'rider' && 'role-tag-active']" @click="role = 'rider'">🛵 骑手</text>
          </view>
        </view>
      </view>

      <button class="submit-btn" @click="handleSubmit" :loading="loading">
        {{ isRegister ? '注 册' : '登 录' }}
      </button>
    </view>
  </view>
</template>

<script>
import { register, login } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'
import { isValidPhone, isValidPassword } from '@/utils/validate.js'

export default {
  data() {
    return {
      isRegister: false,
      phone: '',
      password: '',
      nickname: '',
      role: 'user',
      loading: false
    }
  },
  methods: {
    async handleSubmit() {
      if (!isValidPhone(this.phone)) {
        uni.showToast({ title: '请输入正确的11位手机号', icon: 'none' })
        return
      }
      if (!isValidPassword(this.password)) {
        uni.showToast({ title: '密码至少6位', icon: 'none' })
        return
      }

      this.loading = true

      try {
        if (this.isRegister) {
          await register({
            phone: this.phone,
            password: this.password,
            role: this.role,
            nickname: this.nickname
          })
          uni.showToast({ title: '注册成功，请登录', icon: 'success' })
          this.isRegister = false
        } else {
          const res = await login({
            phone: this.phone,
            password: this.password
          })
          const userStore = useUserStore()
          userStore.login(res.token, res.用户信息)

          uni.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            uni.switchTab({ url: '/pages/home/index' })
          }, 1000)
        }
      } catch (e) {
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #FF6B35 0%, #FF8C42 40%, #f5f5f5 40%);
  padding-top: 80rpx;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 40rpx;
}
.logo-emoji {
  font-size: 100rpx;
}
.logo-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  margin-top: 10rpx;
}
.logo-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 8rpx;
}

.form-card {
  margin: 0 40rpx;
  background-color: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.1);
}

.tab-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}
.tab-item {
  font-size: 32rpx;
  color: #999;
  padding: 10rpx 40rpx;
  margin: 0 10rpx;
  border-bottom: 4rpx solid transparent;
}
.tab-active {
  color: #FF6B35;
  font-weight: bold;
  border-bottom-color: #FF6B35;
}

.input-group {
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 24rpx 0;
}
.input-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}
.input {
  flex: 1;
  font-size: 28rpx;
}

.role-section {
  padding: 24rpx 0;
}
.role-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 16rpx;
  display: block;
}
.role-list {
  display: flex;
  gap: 16rpx;
}
.role-tag {
  font-size: 26rpx;
  padding: 12rpx 24rpx;
  border-radius: 30rpx;
  border: 2rpx solid #ddd;
  color: #666;
}
.role-tag-active {
  border-color: #FF6B35;
  color: #FF6B35;
  background-color: #FFF3EE;
}

.submit-btn {
  margin-top: 40rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  color: #fff;
  font-size: 32rpx;
  border-radius: 50rpx;
  height: 88rpx;
  line-height: 88rpx;
  border: none;
}
</style>
