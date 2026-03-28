<template>
  <view class="container">
    <!-- #ifdef H5 -->
    <iframe :src="webViewSrc" class="web-iframe"></iframe>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <web-view :src="webViewSrc"></web-view>
    <!-- #endif -->
  </view>
</template>

<script>
export default {
  data() {
    return {
      webViewSrc: ''
    }
  },
  onLoad(options) {
    const { token, riderId } = options
    
    if (!token || !riderId) {
      uni.showToast({
        title: '参数缺失',
        icon: 'none'
      })
      return
    }
    
    this.webViewSrc = `http://192.168.1.4:5500/driver_map.html?token=${token}&riderId=${riderId}`
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh;
}

.web-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
