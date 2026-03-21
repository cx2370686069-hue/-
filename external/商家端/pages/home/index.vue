<template>
  <view class="container">
    <view class="header">
      <text class="header-title">固始县外卖</text>
    </view>

    <view class="banner">
      <swiper class="swiper" autoplay circular indicator-dots indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#fff">
        <swiper-item>
          <view class="banner-card">
            <view class="banner-content">
              <text class="banner-title banner-title-lg">固始外卖送到村里</text>
            </view>
            <text class="banner-emoji">🛵</text>
          </view>
        </swiper-item>
        <swiper-item>
          <view class="banner-card banner-card2">
            <view class="banner-content">
              <text class="banner-title">足不出户 坐等美食</text>
              <text class="banner-sub">每日精选超值好物</text>
            </view>
            <text class="banner-emoji">🎉</text>
          </view>
        </swiper-item>
        <swiper-item>
          <view class="banner-card banner-card3">
            <view class="banner-content">
              <text class="banner-title">招乡镇站长免加盟费</text>
              <text class="banner-sub">每个乡镇仅限一名</text>
            </view>
            <text class="banner-emoji">📋</text>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view class="service-cards">
      <view class="service-card service-card-orange" @click="onCountyTakeawayClick">
        <view class="service-card-content">
          <text class="service-card-title">县城美食外卖</text>
          <text class="service-card-desc service-card-desc-lg">城里好货,送到乡镇</text>
        </view>
        <text class="service-card-emoji">🛵</text>
      </view>
      <view class="service-card service-card-green" @click="onTownTakeawayClick">
        <view class="service-card-content">
          <text class="service-card-title">镇上外卖</text>
          <text class="service-card-desc">本地好物,极速送达</text>
        </view>
        <text class="service-card-emoji">📦</text>
      </view>
    </view>

    <view class="category">
      <view
        class="category-item"
        v-for="item in categoryList"
        :key="item.id"
        @click="onCategoryClick(item)"
      >
        <view class="category-icon-wrap" :style="{backgroundColor: item.bgColor}" :class="{active: currentCategory === item.name}">
          <text class="category-emoji">{{item.emoji}}</text>
        </view>
        <text class="category-name" :class="{activeName: currentCategory === item.name}">{{item.name}}</text>
      </view>
    </view>

    <view class="goods-section" v-if="currentCategory">
      <view class="section-header">
        <text class="section-title">{{ currentCategory }}</text>
        <text class="clear-filter" @click="clearFilter">查看全部</text>
      </view>
      <view class="goods-list">
        <view class="goods-item" v-for="item in goodsList" :key="item.商品ID" @click="goDetail(item.商品ID)">
          <view class="goods-img-wrap"><text class="goods-emoji">🍱</text></view>
          <view class="goods-info">
            <text class="goods-name">{{item.商品名称}}</text>
            <text class="goods-desc">月售 {{item.月销}} · {{item.描述}}</text>
            <view class="goods-bottom">
              <text class="goods-price">¥{{item.价格}}</text>
              <view class="add-btn" @click.stop="handleAddToCart(item)"><text class="add-btn-text">+</text></view>
            </view>
          </view>
        </view>
      </view>
      <view class="empty-goods" v-if="goodsList.length === 0"><text class="empty-text">该分类暂无商品</text></view>
    </view>
  </view>
</template>

<script>
import { getFoodList } from '@/api/food.js'
import { addToCart } from '@/api/cart.js'
import { requireLogin } from '@/utils/auth.js'
import { CATEGORY_LIST } from '@/config/index.js'

export default {
  data() {
    return {
      goodsList: [],
      currentCategory: '',
      categoryList: CATEGORY_LIST,
      sortType: '综合排序'
    }
  },
  onShow() {
    this.updateCartBadge()
  },
  async onPullDownRefresh() {
    await this.getGoodsList(this.currentCategory || undefined, this.sortType)
    uni.stopPullDownRefresh()
  },
  methods: {
    async getGoodsList(category, sort) {
      try {
        const res = await getFoodList(category || undefined, sort || this.sortType)
        this.goodsList = res.商品列表 || []
      } catch (e) {}
    },
    onCountyTakeawayClick() {
      uni.navigateTo({ url: '/pages/county-takeaway/index' })
    },
    onTownTakeawayClick() {
      uni.navigateTo({ url: '/pages/town-takeaway/index' })
    },
    async handleAddToCart(item) {
      if (!requireLogin()) return
      try {
        const res = await addToCart(item.商品ID)
        uni.showToast({ title: res.消息, icon: 'success' })
        this.updateCartBadge()
      } catch (e) {}
    },
    async updateCartBadge() {
      try {
        const { getCartList } = require('@/api/cart.js')
        const res = await getCartList()
        const count = res.总数量 || 0
        if (count > 0) {
          uni.setTabBarBadge({ index: 1, text: String(count) })
        } else {
          uni.removeTabBarBadge({ index: 1 })
        }
      } catch (e) {}
    },
    onCategoryClick(item) {
      if (item.name === '跑腿代购') {
        uni.navigateTo({ url: '/pages/errand/index' })
        return
      }
      if (item.name === '二手机买卖') {
        uni.navigateTo({ url: '/pages/mobile-digital/index' })
        return
      }
      if (item.name === '家电维修') {
        uni.navigateTo({ url: '/pages/appliance-repair/index' })
        return
      }
      if (item.name === '五金工具') {
        uni.navigateTo({ url: '/pages/hardware/index' })
        return
      }
      if (item.name === '数码配件') {
        uni.navigateTo({ url: '/pages/digital-parts/index' })
        return
      }
      if (item.name === '代取快递') {
        uni.navigateTo({ url: '/pages/express-pickup/index' })
        return
      }
      if (item.name === '附近超市') {
        uni.navigateTo({ url: '/pages/supermarket/index' })
        return
      }
      if (item.name === '顺路带货') {
        uni.navigateTo({ url: '/pages/ridealong/index' })
        return
      }
      if (this.currentCategory === item.name) {
        this.clearFilter()
      } else {
        this.currentCategory = item.name
        this.getGoodsList(item.name, this.sortType)
      }
    },
    onSortClick(sort) {
      this.sortType = sort
      if (this.currentCategory) {
        this.getGoodsList(this.currentCategory, sort)
      }
    },
    clearFilter() {
      this.currentCategory = ''
      this.getGoodsList()
    },
    onServiceCardClick(type) {
      uni.showToast({ title: type + ' 敬请期待', icon: 'none' })
    },
    goDetail(id) {
      uni.navigateTo({ url: '/pages/food/detail?id=' + id })
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 20rpx;
}

.header {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 30rpx 30rpx 24rpx;
}
.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.banner {
  padding: 0 20rpx;
  margin-top: -10rpx;
}
.swiper {
  height: 260rpx;
  border-radius: 20rpx;
  overflow: hidden;
}
.banner-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #FF6B35, #FF9A56);
  height: 100%;
  border-radius: 20rpx;
  padding: 30rpx;
}
.banner-card2 {
  background: linear-gradient(135deg, #FF4757, #FF6B81);
}
.banner-card3 {
  background: linear-gradient(135deg, #3498db, #2980b9);
}
.banner-content {
  flex: 1;
}
.banner-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 12rpx;
}
.banner-title-lg {
  font-size: 44rpx;
  margin-bottom: 0;
}
.banner-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.85);
}
.banner-emoji {
  font-size: 90rpx;
}

.service-cards {
  display: flex;
  gap: 20rpx;
  margin: 20rpx;
}
.service-card {
  flex: 1 1 0%;
  min-width: 0;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 168rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
}
.service-card-orange {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
}
.service-card-green {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
}
.service-card-content {
  flex: 1;
}
.service-card-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 10rpx;
  white-space: nowrap;
}
.service-card-desc {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
}
.service-card-desc-lg {
  font-size: 30rpx;
}
.service-card-emoji {
  font-size: 88rpx;
  margin-left: 20rpx;
}

.category {
  display: flex;
  flex-wrap: wrap;
  background-color: #fff;
  margin: 0 20rpx;
  margin-top: 48rpx;
  border-radius: 20rpx;
  padding: 24rpx 10rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.category-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
}
.category-icon-wrap {
  width: 128rpx;
  height: 128rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
  transition: all 0.2s;
}
.category-icon-wrap.active {
  border: 3rpx solid #FF6B35;
  box-shadow: 0 4rpx 16rpx rgba(255,107,53,0.3);
}
.category-emoji {
  font-size: 64rpx;
}
.category-name {
  font-size: 28rpx;
  color: #333;
}
.category-name.activeName {
  color: #FF6B35;
  font-weight: bold;
}

.goods-section {
  margin: 20rpx;
  background-color: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.section-header {
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}
.clear-filter {
  font-size: 24rpx;
  color: #FF6B35;
  padding: 6rpx 16rpx;
  border: 1rpx solid #FF6B35;
  border-radius: 20rpx;
}
.goods-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.goods-item:last-child {
  border-bottom: none;
}
.goods-img-wrap {
  width: 160rpx;
  height: 160rpx;
  background-color: #FFF5EE;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}
.goods-emoji {
  font-size: 70rpx;
}
.goods-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.goods-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.goods-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}
.goods-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
}
.goods-price {
  font-size: 34rpx;
  color: #FF6B35;
  font-weight: bold;
}
.add-btn {
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-btn-text {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
  line-height: 48rpx;
}

.empty-goods {
  padding: 60rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
}
</style>
