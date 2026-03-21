<script>
export default {
  onLaunch: function() {
    console.log('App Launch - 骑手端启动')
  },
  onShow: function() {
    console.log('App Show - 骑手端显示')
  },
  onHide: function() {
    console.log('App Hide - 骑手端隐藏')
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
