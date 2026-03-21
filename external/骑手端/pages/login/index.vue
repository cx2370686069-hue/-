<template>
  <view class="container">
    <view class="logo-section">
      <text class="logo-emoji">🛵</text>
      <text class="app-name">固始县外卖骑手端</text>
      <text class="app-desc">骑手专用接单配送</text>
    </view>

    <view class="form-section">
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input 
          v-model="form.phone" 
          type="number" 
          maxlength="11"
          placeholder="请输入手机号"
          class="form-input"
        />
      </view>

      <view class="form-item">
        <text class="form-label">密码</text>
        <input 
          v-model="form.password" 
          type="password" 
          placeholder="请输入密码"
          class="form-input"
        />
      </view>

      <button class="login-btn" @click="handleLogin" :loading="loading">
        登录
      </button>

      <view class="tips">
        <text class="tip-text">还没有账号？</text>
        <text class="tip-link" @click="goRegister">立即注册</text>
      </view>
    </view>
  </view>
</template>

<script>
import { login } from '@/api/auth.js'
import { setToken, setUserInfo } from '@/utils/storage.js'

export default {
  data() {
    return {
      form: {
        phone: '',
        password: ''
      },
      loading: false
    }
  },
  methods: {
    async handleLogin() {
      const { phone, password } = this.form
      
      // 验证
      if (!phone || phone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
      }
      
      if (!password || password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' })
        return
      }
      
      this.loading = true
      
      try {
        const res = await login({ phone, password })
        
        // 保存 token 和用户信息
        if (res.data) {
          setToken(res.data.token)
          setUserInfo(res.data.user)
          
          // 检查是否是骑手角色
          if (res.data.user.role !== 'rider') {
            uni.showToast({ 
              title: '该账号不是骑手账号', 
              icon: 'none',
              duration: 2000
            })
            setTimeout(() => {
              uni.clearStorageSync()
            }, 2000)
            return
          }
          
          uni.showToast({ title: '登录成功', icon: 'success' })
          
          // 跳转到工作台
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/index/index' })
          }, 1500)
        }
      } catch (e) {
        console.error('登录失败:', e)
      } finally {
        this.loading = false
      }
    },
    
    goRegister() {
      uni.showToast({ title: '请联系管理员注册', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  padding: 120rpx 40rpx 40rpx;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.logo-emoji {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.app-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
}

.app-desc {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
}

.form-section {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 12rpx;
  border: none;
  margin-top: 24rpx;
}

.tips {
  display: flex;
  justify-content: center;
  margin-top: 32rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #999;
}

.tip-link {
  font-size: 26rpx;
  color: #1890ff;
  margin-left: 8rpx;
}
</style>
