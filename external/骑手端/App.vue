<script>
import { updateRiderStatus } from '@/api/order.js'
import { getTownErrandConversations } from '@/api/town-errand-message.js'
import { reportLocation } from '@/api/user.js'
import { getToken, getUserInfo as getStoredUserInfo, setRiderStatus } from '@/utils/storage.js'
import { speakTownErrandIncomingMessage } from '@/utils/town-errand-voice.js'

let locationTimer = null
let townMessageBootstrapTimer = null
let townMessagePollTimer = null
let locationPermissionPrompted = false
let townMessageWatcherStarted = false
let townMessageState = {
  initialized: false,
  unreadTotal: 0
}

function pickList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function pickUnreadCount(item = {}) {
  const unread = item.unread_count ?? item.unreadCount ?? item.unread_num
  return Number(unread) > 0 ? Number(unread) : 0
}

function isTownStationmaster(userInfo = {}) {
  return userInfo.rider_kind === 'stationmaster' || userInfo.delivery_scope === 'town_delivery'
}

function isCountyDriver(userInfo = {}) {
  return userInfo.delivery_scope === 'county_delivery' && userInfo.rider_kind === 'rider'
}

export default {
  onLaunch: function() {
    console.log('App Launch - 骑手端启动')
    this.startTownMessageWatcher()
  },
  onShow: function() {
    console.log('App Show - 骑手端显示')
    this.syncCountyDriverOnlineStatus()
    this.startLocationReport()
    this.startTownMessageWatcher()
  },
  onHide: function() {
    console.log('App Hide - 骑手端隐藏')
    this.stopLocationReport()
    this.stopTownMessageWatcher()
  },
  methods: {
    startLocationReport() {
      this.stopLocationReport()
      
      const token = uni.getStorageSync('token')
      if (!token) {
        console.log('未登录，不启动位置上报')
        return
      }
      
      console.log('启动位置上报定时器，间隔 10 秒')
      
      locationTimer = setInterval(() => {
        this.doReportLocation()
      }, 10000)
      
      this.doReportLocation()
    },
    
    stopLocationReport() {
      if (locationTimer) {
        clearInterval(locationTimer)
        locationTimer = null
        console.log('位置上报定时器已停止')
      }
    },
    
    doReportLocation() {
      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          locationPermissionPrompted = false
          console.log('获取真实GPS成功:', res.latitude, res.longitude)
          reportLocation(res.latitude, res.longitude)
            .catch(err => console.log('真实位置上报接口失败:', err))
        },
        fail: (err) => {
          console.log('获取真实GPS失败，未执行位置上报:', err)
          this.handleLocationPermissionError(err)
        }
      })
    },
    handleLocationPermissionError(err) {
      const errMsg = String(err?.errMsg || err?.message || '')
      const isPermissionDenied = errMsg.includes('auth deny') || errMsg.includes('authorize no response') || errMsg.includes('auth denied')

      if (!isPermissionDenied || locationPermissionPrompted) {
        return
      }

      locationPermissionPrompted = true
      uni.showModal({
        title: '需要定位权限',
        content: '县城司机要出现在调度台，必须允许定位权限并成功上报当前位置。请前往授权。',
        confirmText: '去授权',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm && typeof uni.openSetting === 'function') {
            uni.openSetting({
              success: () => {
                locationPermissionPrompted = false
                this.doReportLocation()
              }
            })
          }
        }
      })
    },
    async syncCountyDriverOnlineStatus() {
      const token = getToken()
      const storedUser = getStoredUserInfo() || {}

      if (!token || !isCountyDriver(storedUser)) {
        return
      }

      const rawStatus = uni.getStorageSync('riderStatus')
      const hasSavedStatus = rawStatus !== '' && rawStatus !== null && typeof rawStatus !== 'undefined'
      const nextStatus = hasSavedStatus ? (Number(rawStatus) === 1 ? 1 : 0) : 1

      if (!hasSavedStatus) {
        setRiderStatus(nextStatus)
      }

      try {
        await updateRiderStatus(nextStatus)
        console.log('县城司机在线状态已同步到后端:', nextStatus)
      } catch (error) {
        console.error('县城司机在线状态同步失败:', error)
      }
    },

    startTownMessageWatcher() {
      this.stopTownMessageWatcher()
      console.log('启动镇上跑腿代购全局监听引导器')
      this.ensureTownMessageWatcher()
      townMessageBootstrapTimer = setInterval(() => {
        this.ensureTownMessageWatcher()
      }, 2000)
    },

    stopTownMessageWatcher() {
      if (townMessageBootstrapTimer) {
        clearInterval(townMessageBootstrapTimer)
        townMessageBootstrapTimer = null
      }
      if (townMessagePollTimer) {
        clearInterval(townMessagePollTimer)
        townMessagePollTimer = null
      }
      townMessageWatcherStarted = false
      townMessageState = {
        initialized: false,
        unreadTotal: 0
      }
      console.log('镇上跑腿代购全局监听已停止')
    },

    ensureTownMessageWatcher() {
      const token = getToken()
      const storedUser = getStoredUserInfo() || {}

      if (!token) {
        if (townMessageWatcherStarted) {
          console.log('未登录，停止镇上跑腿代购全局监听')
        }
        if (townMessagePollTimer) {
          clearInterval(townMessagePollTimer)
          townMessagePollTimer = null
        }
        townMessageWatcherStarted = false
        townMessageState = {
          initialized: false,
          unreadTotal: 0
        }
        return
      }

      if (!isTownStationmaster(storedUser)) {
        if (townMessageWatcherStarted) {
          console.log('当前账号不是乡镇站长，停止镇上跑腿代购全局监听')
        }
        if (townMessagePollTimer) {
          clearInterval(townMessagePollTimer)
          townMessagePollTimer = null
        }
        townMessageWatcherStarted = false
        townMessageState = {
          initialized: false,
          unreadTotal: 0
        }
        return
      }

      if (townMessageWatcherStarted && townMessagePollTimer) {
        return
      }

      console.log('已启动镇上跑腿代购全局常驻监听')
      townMessageWatcherStarted = true
      this.checkTownMessageConversations(true)
      townMessagePollTimer = setInterval(() => {
        this.checkTownMessageConversations(false)
      }, 2000)
    },

    async checkTownMessageConversations(isFirstLoad = false) {
      try {
        const res = await getTownErrandConversations()
        const source = pickList(res?.data ?? res)
        const unreadTotal = source.reduce((sum, item = {}) => sum + pickUnreadCount(item), 0)

        if (!townMessageState.initialized || isFirstLoad) {
          townMessageState = {
            initialized: true,
            unreadTotal
          }
          console.log('镇上跑腿代购全局监听初始化完成', { unreadTotal })
          return
        }

        if (unreadTotal > townMessageState.unreadTotal) {
          console.log('检测到新的镇上跑腿代购未读消息，触发全局语音播报', {
            previousUnreadTotal: townMessageState.unreadTotal,
            unreadTotal
          })
          speakTownErrandIncomingMessage()
        }

        townMessageState = {
          initialized: true,
          unreadTotal
        }
      } catch (error) {
        console.error('镇上跑腿代购全局监听拉取失败', error)
      }
    }
  }
}
</script>

<style>
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 主题色 */
.primary-color {
  color: #1890FF;
}

.primary-bg {
  background-color: #1890FF;
}

/* 卡片样式 */
.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

/* 按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  border: none;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  border: none;
}
</style>
