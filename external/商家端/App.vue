<script>
  export default {
    onLaunch() {
      console.log('App Launch')
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
