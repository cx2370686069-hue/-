<template>
  <view class="container">
    <view class="user-card">
      <view class="avatar-wrap">
        <text class="avatar-text">🛵</text>
      </view>
      <view class="user-info">
        <text class="nickname">{{ userInfo.nickname || '骑手' }}</text>
        <text class="phone">{{ userInfo.phone || '未绑定' }}</text>
      </view>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="showTip('账户余额')">
        <text class="menu-icon">💰</text>
        <text class="menu-text">账户余额</text>
        <text class="menu-value">¥{{ balance }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view v-if="isTownStationRole" class="menu-item" @click="showStationPanel = !showStationPanel">
        <text class="menu-icon">📍</text>
        <text class="menu-text">站长乡镇</text>
        <text class="menu-value">{{ userInfo.rider_town || '未绑定' }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view v-else class="menu-item" @click="showTip('配送范围')">
        <text class="menu-icon">📍</text>
        <text class="menu-text">配送范围</text>
        <text class="menu-value">{{ deliveryScopeLabel }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showTip('修改密码')">
        <text class="menu-icon">🔒</text>
        <text class="menu-text">修改密码</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showTip('联系客服')">
        <text class="menu-icon">📞</text>
        <text class="menu-text">联系客服</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showTip('关于我们')">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-text">关于我们</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="station-panel" v-if="showStationPanel">
      <view class="station-row">
        <text class="station-label">乡镇名称</text>
        <input class="station-input" v-model="stationTown" placeholder="例如：陈淋子镇" />
      </view>
      <button class="station-btn" @click="bindTown">绑定为站长</button>
      <text class="station-tip">每个乡镇只允许一个站长账号绑定</text>
    </view>

    <view class="logout-btn" @click="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>
  </view>
</template>

<script>
import { getUserInfo, bindStationTown } from '@/api/user.js'
import { getUserInfo as getStoredUserInfo, removeToken, removeUserInfo } from '@/utils/storage.js'

export default {
  data() {
    return {
      userInfo: {},
      balance: '0.00',
      showStationPanel: false,
      stationTown: ''
    }
  },
  computed: {
    isTownStationRole() {
      return this.userInfo.rider_kind === 'stationmaster' || this.userInfo.delivery_scope === 'town_delivery'
    },
    deliveryScopeLabel() {
      return this.userInfo.delivery_scope === 'county_delivery' ? '县城配送' : '骑手配送'
    }
  },
  onLoad() {
    this.loadUserInfo()
  },
  methods: {
    async loadUserInfo() {
      const stored = getStoredUserInfo()
      if (stored) {
        this.userInfo = stored
      }
      
      try {
        const res = await getUserInfo()
        if (res.data) {
          this.userInfo = res.data
          this.balance = res.data.rider_balance || '0.00'
          this.stationTown = res.data.rider_town || ''
        }
      } catch (e) {
        console.error('加载用户信息失败', e)
      }
    },

    async bindTown() {
      const town = String(this.stationTown || '').trim()
      if (!town) {
        uni.showToast({ title: '请填写乡镇名称', icon: 'none' })
        return
      }
      try {
        await bindStationTown(town)
        uni.showToast({ title: '绑定成功', icon: 'success' })
        this.loadUserInfo()
      } catch (e) {
        console.error('绑定失败', e)
      }
    },
    
    showTip(name) {
      uni.showToast({ title: name + '功能开发中', icon: 'none' })
    },
    
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            removeToken()
            removeUserInfo()
            uni.reLaunch({ url: '/pages/login/index' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20rpx;
}

.user-card {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.avatar-wrap {
  width: 100rpx;
  height: 100rpx;
  background-color: rgba(255,255,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.station-panel {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 20rpx;
}

.station-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.station-label {
  font-size: 26rpx;
  color: #666;
  width: 140rpx;
}

.station-input {
  flex: 1;
  height: 72rpx;
  background-color: #f6f6f6;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
}

.station-btn {
  margin-top: 20rpx;
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
  border-radius: 12rpx;
}

.station-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #999;
}

.avatar-text {
  font-size: 50rpx;
}

.user-info {
  flex: 1;
}

.nickname {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 8rpx;
}

.phone {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  display: block;
}

.menu-list {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.menu-value {
  font-size: 28rpx;
  color: #FF6B35;
  font-weight: bold;
  margin-right: 16rpx;
}

.menu-arrow {
  font-size: 32rpx;
  color: #ccc;
}

.logout-btn {
  margin-top: 40rpx;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  text-align: center;
}

.logout-text {
  font-size: 28rpx;
  color: #ff4d4f;
}
</style>
