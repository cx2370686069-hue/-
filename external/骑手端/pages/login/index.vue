<template>
  <view class="container">
    <view class="header">
      <text class="title">{{ isRegisterMode ? '骑手注册' : '骑手登录' }}</text>
    </view>

    <view class="form-container">
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
          placeholder="请输入密码（至少6位）" 
          class="form-input" 
        />
      </view>

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">确认密码</text>
        <input 
          v-model="form.confirmPassword" 
          type="password" 
          placeholder="请再次输入密码" 
          class="form-input" 
        />
      </view>

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">昵称（选填）</text>
        <input 
          v-model="form.nickname" 
          type="text" 
          placeholder="请输入昵称" 
          class="form-input" 
        />
      </view>

      <button class="submit-btn" @click="handleSubmit">
        {{ isRegisterMode ? '注册' : '登录' }}
      </button>

      <view class="toggle-mode">
        <text class="tip-text">{{ isRegisterMode ? '已有账号？' : '没有账号？' }}</text>
        <text class="tip-link" @click="toggleMode">{{ isRegisterMode ? '立即登录' : '立即注册' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { login, register } from '@/api/auth.js'
import { setToken, setUserInfo } from '@/utils/storage.js'

export default {
  data() {
    return {
      form: {
        phone: '',
        password: '',
        confirmPassword: '',
        nickname: ''
      },
      isRegisterMode: false,
      loading: false
    }
  },
  methods: {
    toggleMode() {
      this.isRegisterMode = !this.isRegisterMode
      this.form.confirmPassword = ''
      this.form.nickname = ''
    },
    
    validateForm() {
      const { phone, password, confirmPassword, nickname } = this.form
      
      if (!phone || phone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return false
      }
      
      if (!password || password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' })
        return false
      }
      
      if (this.isRegisterMode) {
        if (password !== confirmPassword) {
          uni.showToast({ title: '两次密码不一致', icon: 'none' })
          return false
        }
      }
      
      return true
    },
    
    async handleSubmit() {
      if (!this.validateForm()) return
      
      this.loading = true
      
      try {
        if (this.isRegisterMode) {
          await this.handleRegister()
        } else {
          await this.handleLogin()
        }
      } catch (e) {
        console.error('操作失败:', e)
      } finally {
        this.loading = false
      }
    },
    
    async handleLogin() {
      const { phone, password } = this.form
      
      const res = await login({ phone, password })
      
      if (res.data) {
        setToken(res.data.token)
        setUserInfo(res.data.user)
        
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
        
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' })
        }, 1500)
      }
    },
    
    async handleRegister() {
      const { phone, password, nickname } = this.form
      
      const registerData = {
        phone,
        password,
        nickname: nickname || `骑手${phone.slice(-4)}`,
        role: 'rider',
        rider_kind: 'county'
      }
      
      const res = await register(registerData)
      
      uni.showToast({ 
        title: '注册成功，请登录', 
        icon: 'success',
        duration: 2000
      })
      
      this.isRegisterMode = false
      this.form.password = ''
      this.form.confirmPassword = ''
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  padding: 80rpx 40rpx 40rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.form-container {
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

.submit-btn {
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

.toggle-mode {
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
