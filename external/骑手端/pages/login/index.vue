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


      <view class="for【指令】请帮我在骑手端增加“实时上报地理位置”的功能。当前后端大屏调度台需要收到骑手坐标才能派单。

具体要求：
1. 打开 `api/user.js`，在文件末尾新增以下接口：
```javascript
/**
 * 上报骑手位置
 */
export function reportLocation(latitude, longitude) {
  return post('/rider/location/report', { latitude, longitude })
}
```
2. 打开 `App.vue`，在全局增加一个定时器，每 10 秒上报一次位置：
- 在 `data` 或外部定义一个 `locationTimer`。
- 在 `onShow` 生命周期中，判断如果本地有 token（即已登录状态），则启动 `setInterval`。
- 定时器内使用 `uni.getLocation({ type: 'gcj02' })` 获取经纬度，获取成功后调用 `reportLocation(res.latitude, res.longitude)` 上报给后端。
- 在 `onHide` 生命周期中清除定时器 `clearInterval`，防止后台耗电。
- 注意：如果获取定位失败，`catch` 捕获异常打印个日志即可，千万不要让程序崩溃或弹窗报错打扰用户。

请直接帮我修改代码！修改完后我会刷新 HBuilderX 测试。          type="password" 
          placeholder="请输入密码（至少6位）"
          class="form-input"
        />
      </view>m-item" v-if="isRegisterMode">
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

      <button class="login-btn" @click="handleSubmit" :loading="loading">
        {{ isRegisterMode ? '注册' : '登录' }}
      </button>

      <view class="tips">
        <text class="tip-text">{{ isRegisterMode ? '已有账号？' : '还没有账号？' }}</text>
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
