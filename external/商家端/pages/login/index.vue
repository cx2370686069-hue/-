<template>
  <view class="container">
    <view class="logo-area">
      <text class="logo-emoji">🏪</text>
      <text class="logo-title">固始县外卖</text>
      <text class="logo-sub">商家端 · 店铺经营与订单管理</text>
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

      <view v-if="isRegister" class="input-group">
        <text class="input-icon">😊</text>
        <input class="input" v-model="nickname" placeholder="店铺老板昵称" />
      </view>

      <button class="submit-btn" @click="handleSubmit" :loading="loading">
        {{ isRegister ? '注册成为商家' : '登 录' }}
      </button>
    </view>
  </view>
</template>

<script>
import { register, login } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'
import { initSocket } from '@/utils/socket.js'
import { isValidPhone, isValidPassword, isNotEmpty } from '@/utils/validate.js'

export default {
  data() {
    return {
      isRegister: false,
      phone: '',
      password: '',
      nickname: '',
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
      if (this.isRegister && !isNotEmpty(this.nickname)) {
        uni.showToast({ title: '请填写店铺老板昵称', icon: 'none' })
        return
      }

      this.loading = true

      try {
        if (this.isRegister) {
          await register({
            phone: this.phone,
            password: this.password,
            nickname: this.nickname.trim()
          })
          uni.showToast({ title: '注册成功，请登录', icon: 'success' })
          this.isRegister = false
        } else {
          const res = await login({
            phone: this.phone,
            password: this.password
          })

          const userStore = useUserStore()

          const token =
            res.data?.token ||
            res.token ||
            res.access_token ||
            res.data?.access_token ||
            ''

          const userInfo =
            res.data?.userInfo ||
            res.data?.user ||
            res.userInfo ||
            res.user || {
              name: '商家',
              phone: this.phone,
              role: 'merchant'
            }

          if (!token) {
            uni.showToast({ title: '登录返回数据异常，未获取到 Token', icon: 'none' })
            return
          }

          uni.setStorageSync('token', token)
          userStore.login(token, userInfo)

          const userId = userInfo?.id || userInfo?.userId || ''
          initSocket(token, userId)

          uni.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/shop/shop-apply' })
          }, 800)
        }
      } catch (e) {
        // 错误提示由 request.js 统一处理
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
