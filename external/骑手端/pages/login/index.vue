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

      <view class="form-item" v-if="isRegisterMode">
        <text class="form-label">配送业务线</text>
        <view class="scope-options">
          <view
            v-for="item in deliveryScopeOptions"
            :key="item.value"
            class="scope-option"
            :class="{ active: form.delivery_scope === item.value }"
            @click="selectDeliveryScope(item.value)"
          >
            <text
              class="scope-option-text"
              :class="{ active: form.delivery_scope === item.value }"
            >
              {{ item.label }}
            </text>
          </view>
        </view>
      </view>

      <view class="form-item" v-if="isRegisterMode && isTownDelivery">
        <text class="form-label">所属乡镇</text>
        <picker
          mode="selector"
          :range="townOptions"
          range-key="label"
          :value="selectedTownIndex"
          @change="handleTownChange"
        >
          <view class="picker-input" :class="{ placeholder: !selectedTownLabel }">
            {{ townPickerText }}
          </view>
        </picker>
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
import { login, registerRider } from '@/api/auth.js'
import { getTownServiceAreas } from '@/api/common.js'
import { setToken, setUserInfo, setRiderStatus } from '@/utils/storage.js'
import { RIDER_DELIVERY_SCOPE_OPTIONS } from './rider-register-options.js'

const LOGIN_PAGE_MODE_KEY = 'rider_login_page_mode'

export default {
  onLoad() {
    this.restoreMode()
  },
  onShow() {
    this.restoreMode()
  },
  data() {
    return {
      form: {
        phone: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        delivery_scope: '',
        town_code: ''
      },
      deliveryScopeOptions: RIDER_DELIVERY_SCOPE_OPTIONS,
      townOptions: [],
      townOptionsLoaded: false,
      townOptionsLoading: false,
      townOptionsLoadFailed: false,
      isRegisterMode: false,
      loading: false
    }
  },
  computed: {
    isTownDelivery() {
      return this.form.delivery_scope === 'town_delivery'
    },
    selectedTownIndex() {
      return Math.max(this.townOptions.findIndex(item => item.value === this.form.town_code), 0)
    },
    selectedTownLabel() {
      const selectedTown = this.townOptions.find(item => item.value === this.form.town_code)
      return selectedTown ? selectedTown.label : ''
    },
    townPickerText() {
      if (this.selectedTownLabel) {
        return this.selectedTownLabel
      }
      if (this.townOptionsLoading) {
        return '乡镇列表加载中...'
      }
      if (this.townOptionsLoadFailed) {
        return '乡镇列表加载失败，请重试'
      }
      return '请选择所属乡镇'
    }
  },
  methods: {
    restoreMode() {
      this.isRegisterMode = uni.getStorageSync(LOGIN_PAGE_MODE_KEY) === 'register'
    },
    setMode(isRegisterMode) {
      this.isRegisterMode = !!isRegisterMode
      uni.setStorageSync(LOGIN_PAGE_MODE_KEY, this.isRegisterMode ? 'register' : 'login')
    },
    getAuditPendingLoginMessage(error) {
      const msg = String(error?.msg || error?.message || '').trim()
      if (!msg) {
        return ''
      }
      if (
        msg.includes('禁用') ||
        msg.includes('停用') ||
        msg.includes('审核') ||
        msg.includes('未通过') ||
        msg.includes('未启用')
      ) {
        return '账号正在审核中，审核通过后才可登录接单'
      }
      return ''
    },
    toggleMode() {
      this.setMode(!this.isRegisterMode)
      this.form.confirmPassword = ''
      this.form.nickname = ''
      this.form.delivery_scope = ''
      this.form.town_code = ''
    },

    resetRegisterForm() {
      this.form.password = ''
      this.form.confirmPassword = ''
      this.form.nickname = ''
      this.form.delivery_scope = ''
      this.form.town_code = ''
    },

    async selectDeliveryScope(deliveryScope) {
      this.form.delivery_scope = deliveryScope
      if (deliveryScope !== 'town_delivery') {
        this.form.town_code = ''
        return
      }

      if (!this.townOptionsLoaded && !this.townOptionsLoading) {
        await this.loadTownOptions()
      }
    },

    handleTownChange(event) {
      const selectedTown = this.townOptions[Number(event.detail.value)]
      this.form.town_code = selectedTown ? selectedTown.value : ''
    },

    async loadTownOptions() {
      this.townOptionsLoading = true
      try {
        const res = await getTownServiceAreas()
        const townOptions = Array.isArray(res.data)
          ? res.data.map(item => ({
              value: item.area_code,
              label: item.area_name
            }))
          : []

        this.townOptions = townOptions
        this.townOptionsLoaded = townOptions.length > 0
        this.townOptionsLoadFailed = false

        if (this.form.town_code && !townOptions.some(item => item.value === this.form.town_code)) {
          this.form.town_code = ''
        }

        if (!townOptions.length) {
          uni.showToast({ title: '暂无可选乡镇', icon: 'none' })
        }
      } catch (e) {
        this.townOptions = []
        this.townOptionsLoaded = false
        this.townOptionsLoadFailed = true
        console.error('乡镇列表加载失败:', e)
      } finally {
        this.townOptionsLoading = false
      }
    },
    
    validateForm() {
      const { phone, password, confirmPassword, delivery_scope, town_code } = this.form
      
      if (!phone || phone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return false
      }
      
      if (!password || password.length < 6) {
        uni.showToast({ title: '密码至少 6 位', icon: 'none' })
        return false
      }
      
      if (this.isRegisterMode) {
        if (!delivery_scope) {
          uni.showToast({ title: '请选择配送业务线', icon: 'none' })
          return false
        }

        if (delivery_scope === 'town_delivery' && !town_code) {
          uni.showToast({ title: '请选择所属乡镇', icon: 'none' })
          return false
        }

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
      let res
      try {
        res = await login({ phone, password })
      } catch (e) {
        const auditPendingMessage = this.getAuditPendingLoginMessage(e)
        if (auditPendingMessage) {
          setTimeout(() => {
            uni.showToast({
              title: auditPendingMessage,
              icon: 'none',
              duration: 2500
            })
          }, 100)
        }
        throw e
      }
      
      if (res.data) {
        setToken(res.data.token)
        setUserInfo(res.data.user)
        if (res.data.user.delivery_scope === 'county_delivery' && res.data.user.rider_kind === 'rider') {
          setRiderStatus(1)
        }
        
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
      const { phone, password, nickname, delivery_scope, town_code } = this.form
      
      const registerData = {
        phone,
        password,
        nickname: nickname || `骑手${phone.slice(-4)}`,
        delivery_scope
      }

      if (delivery_scope === 'town_delivery') {
        registerData.town_code = town_code
      }
      
      await registerRider(registerData)

      this.setMode(false)
      this.resetRegisterForm()
      uni.showModal({
        title: '申请已提交',
        content: '注册申请已提交，请等待平台审核。\n审核通过后才可登录接单。',
        showCancel: false,
        confirmText: '我知道了'
      })
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

.scope-options {
  display: flex;
  flex-direction: column;
}

.scope-option + .scope-option {
  margin-top: 20rpx;
}

.scope-option {
  background: #f5f5f5;
  border: 2rpx solid transparent;
  border-radius: 12rpx;
  padding: 24rpx;
}

.scope-option.active {
  background: rgba(24, 144, 255, 0.08);
  border-color: #1890ff;
}

.scope-option-text {
  font-size: 28rpx;
  color: #333;
}

.scope-option-text.active {
  color: #1890ff;
  font-weight: bold;
}

.picker-input {
  height: 88rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #333;
}

.picker-input.placeholder {
  color: #999;
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
