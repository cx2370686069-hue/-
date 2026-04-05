<script>
  import { getToken, getUser } from '@/utils/auth.js'
  import { initSocket, onNewOrder } from '@/utils/socket.js'
  import { playMerchantNewOrderNotify } from '@/utils/merchant-notify.js'

  export default {
    onLaunch() {
      console.log('App Launch')
      const token = getToken()
      const userInfo = getUser()
      const userId = userInfo?.id || userInfo?.userId || ''
      
      if (token) {
        initSocket(token, userId)
      }
      onNewOrder((data) => {
        console.log('收到新订单推送：', data)
        try {
          playMerchantNewOrderNotify()
        } catch (e) {
          console.error('[merchant] playMerchantNewOrderNotify', e)
        }
        try {
          uni.showToast({ title: '您有新的外卖订单！', icon: 'none' })
        } catch (e) {}
        // 必须始终派发，避免提示音/震动异常导致全链路中断
        uni.$emit('merchant_new_order', data)
      })
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
