<script>
  import { getUserId, getToken, getUser, hasValidMerchantSession, clearAuth } from '@/utils/auth.js'
  import { initSocket } from '@/utils/socket.js'

  export default {
    onLaunch() {
      console.log('App Launch')
      if (!hasValidMerchantSession()) {
        clearAuth()
        uni.reLaunch({ url: '/pages/login/index' })
        return
      }
      const token = getToken()
      const userInfo = getUser()
      const userId = getUserId(userInfo)

      if (token && userId) {
        initSocket(token, userId)
      }
    },
    onShow() {
      console.log('App Show')
    },
    onHide() {
      console.log('App Hide')
    }
  }
</script>

<style lang="scss">
  @import '@/uni_modules/uni-scss/index.scss';
  @import './common/uni.css';
  @import '@/static/customicons.css';

  /* #ifdef H5 */
  @media screen and (min-width: 768px) {
    body { overflow-y: scroll; }
  }
  uni-page-body {
    background-color: #F5F5F5 !important;
    min-height: 100% !important;
    height: auto !important;
  }
  /* #endif */

  page {
    background-color: #efeff4;
    height: 100%;
    font-size: 28rpx;
  }
</style>
