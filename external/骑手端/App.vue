<script>
import { reportLocation } from '@/api/user.js'

let locationTimer = null

export default {
  onLaunch: function() {
    console.log('App Launch - 骑手端启动')
  },
  onShow: function() {
    console.log('App Show - 骑手端显示')
    this.startLocationReport()
  },
  onHide: function() {
    console.log('App Hide - 骑手端隐藏')
    this.stopLocationReport()
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
          console.log('获取真实GPS成功:', res.latitude, res.longitude)
          reportLocation(res.latitude, res.longitude)
            .catch(err => console.log('真实位置上报接口失败:', err))
        },
        fail: (err) => {
          console.log('获取真实GPS失败，使用模拟测试坐标上报')
          reportLocation(32.1765, 115.6734)
            .catch(e => console.log('模拟位置上报接口失败:', e))
        }
      })
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
