<template>
  <view class="container">
    <!-- 顶部：返回 + 外卖|首页|自取 + 搜索（与参考图一致） -->
    <view class="header">
      <view class="search-row" @click="onSearchClick">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">生日蛋糕</text>
        <text class="search-btn">搜索</text>
      </view>
    </view>

    <!-- 促销 banner：膨半价 节日神券 风格 -->
    <view class="banner">
      <swiper class="swiper" autoplay circular indicator-dots indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#fff">
        <swiper-item>
          <view class="banner-card banner-promo">
            <text class="banner-promo-title">膨半价 节日神券</text>
            <view class="banner-promo-tags">
              <text class="promo-tag">抢1888元</text>
              <text class="promo-tag">38节最高得50元</text>
              <text class="promo-tag">2.9元起</text>
            </view>
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

    <!-- 分类：4 个选项，图标和字体加大 -->
    <view class="category-grid category-grid-4">
      <view
        class="category-grid-item"
        v-for="item in countyCategoryList"
        :key="item.id"
        @click="onCountyCategoryClick(item)"
      >
        <view class="category-grid-icon" :style="{backgroundColor: item.bgColor}">
          <text class="category-grid-emoji">{{item.emoji}}</text>
        </view>
        <text class="category-grid-name">{{item.name}}</text>
      </view>
    </view>

    <!-- 县城销量排行榜 -->
    <view class="section" v-if="recommendList.length > 0">
      <view class="section-head">
        <view class="section-head-left">
          <text class="section-title">县城销量排行榜</text>
        </view>
        <text class="section-more" @click="onMoreRank">更多›</text>
      </view>
      <scroll-view class="recommend-scroll" scroll-x>
        <view class="recommend-item" v-for="item in recommendList" :key="item.商品ID" @click="goDetail(item.商品ID)">
          <view class="recommend-img">
            <text class="recommend-emoji">🍱</text>
          </view>
          <text class="recommend-name">{{item.商品名称}}</text>
          <text class="recommend-price">¥{{item.价格}}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 优惠券：外卖大额神券 + 去使用 + 失效时间 -->
    <view class="coupon-row">
      <view class="coupon-card" @click="onCouponUse(20)">
        <view class="coupon-card-left">
          <text class="coupon-value">20</text>
          <text class="coupon-unit">元</text>
          <text class="coupon-title">外卖大额神券</text>
          <text class="coupon-desc">满38可用</text>
          <text class="coupon-expire">08:00:51后失效</text>
        </view>
        <view class="coupon-btn">去使用</view>
      </view>
      <view class="coupon-card" @click="onCouponUse(13)">
        <view class="coupon-card-left">
          <text class="coupon-value">13</text>
          <text class="coupon-unit">元</text>
          <text class="coupon-title">外卖大额神券</text>
          <text class="coupon-desc">满30可用</text>
          <text class="coupon-expire">08:00:51后失效</text>
        </view>
        <view class="coupon-btn">去使用</view>
      </view>
    </view>

    <!-- 附近商家：特价外卖 | 10元点套餐 + 商家卡片 -->
    <view class="section section-merchants">
      <view class="section-head">
        <text class="section-title">附近商家</text>
        <view class="merchant-tabs">
          <text class="merchant-tab" :class="{ active: merchantTab === '特价' }" @click="merchantTab = '特价'">特价外卖</text>
          <text class="merchant-tab" :class="{ active: merchantTab === '10元' }" @click="merchantTab = '10元'">10元点套餐</text>
        </view>
      </view>
      <view class="merchant-list" v-if="recommendList.length > 0">
        <view class="merchant-card" v-for="item in recommendList.slice(0, 6)" :key="item.商品ID" @click="goDetail(item.商品ID)">
          <view class="merchant-card-img">
            <text class="merchant-emoji">🍱</text>
          </view>
          <view class="merchant-card-body">
            <text class="merchant-name">{{item.商品名称}}</text>
            <view class="merchant-meta">
              <text class="merchant-score">4.6分</text>
              <text class="merchant-sales">月售{{item.月销}}+</text>
              <text class="merchant-avg">人均¥{{item.价格}}</text>
            </view>
            <view class="merchant-delivery">
              <text class="delivery-tag">专送</text>
              <text class="delivery-dist">约15分钟</text>
            </view>
            <view class="merchant-tags">
              <text class="tag">起送¥20 免配送费</text>
              <text class="tag coupon-tag">神券 满38减20</text>
            </view>
          </view>
          <view class="merchant-cart" @click.stop="handleAddToCart(item)">
            <text class="cart-icon">🛒</text>
          </view>
        </view>
      </view>
      <view class="empty-goods" v-else>
        <text class="empty-text">暂无商家</text>
      </view>
    </view>

    <view class="section" v-if="currentCategory">
      <view class="section-header">
        <text class="section-title">{{ currentCategory }}</text>
        <text class="clear-filter" @click="clearFilter">查看全部</text>
      </view>
      <view class="sort-bar">
        <view class="sort-item" :class="{ active: sortType === '综合排序' }" @click="onSortClick('综合排序')"><text class="sort-text">综合排序</text></view>
        <view class="sort-item" :class="{ active: sortType === '销量' }" @click="onSortClick('销量')"><text class="sort-text">销量</text></view>
        <view class="sort-item" :class="{ active: sortType === '价格' }" @click="onSortClick('价格')"><text class="sort-text">价格</text></view>
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

const COUNTY_CATEGORY_LIST = [
  { id: 1, name: '外卖', emoji: '🍜', bgColor: '#FFF3E6' },
  { id: 2, name: '超市代购', emoji: '🛒', bgColor: '#E6F7FF' },
  { id: 3, name: '代买药品', emoji: '💊', bgColor: '#FFF0F6' },
  { id: 4, name: '蔬菜水果', emoji: '🥬', bgColor: '#E6FFE6' },
  { id: 5, name: '鲜花礼品', emoji: '💐', bgColor: '#F9F0FF' }
]

export default {
  data() {
    return {
      merchantTab: '特价',
      goodsList: [],
      currentCategory: '',
      countyCategoryList: COUNTY_CATEGORY_LIST,
      sortType: '综合排序',
      recommendList: []
    }
  },
  onLoad() {
    this.loadRecommend()
  },
  onShow() {
    this.updateCartBadge()
  },
  async onPullDownRefresh() {
    await this.loadRecommend()
    await this.getGoodsList(this.currentCategory || undefined, this.sortType)
    uni.stopPullDownRefresh()
  },
  methods: {
    async loadRecommend() {
      try {
        const res = await getFoodList(undefined, '销量')
        this.recommendList = (res.商品列表 || []).slice(0, 10)
      } catch (e) {}
    },
    async getGoodsList(category, sort) {
      try {
        const res = await getFoodList(category || undefined, sort || this.sortType)
        this.goodsList = res.商品列表 || []
      } catch (e) {}
    },
    goBack() {
      uni.navigateBack()
    },
    onMoreRank() {
      uni.showToast({ title: '更多排行敬请期待', icon: 'none' })
    },
    onCouponUse(amount) {
      uni.showToast({ title: amount + '元券去使用', icon: 'none' })
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
    onCountyCategoryClick(item) {
      if (item.name === '外卖') {
        this.clearFilter()
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
    onSearchClick() {
      uni.navigateTo({ url: '/pages/search/index' })
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
  background: #fff;
  padding: 20rpx 24rpx 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}
.search-row { display: flex; align-items: center; background: #f5f5f5; border-radius: 32rpx; padding: 18rpx 24rpx; }
.search-row .search-icon { font-size: 28rpx; margin-right: 12rpx; }
.search-row .search-placeholder { flex: 1; font-size: 26rpx; color: #999; }
.search-btn { font-size: 26rpx; color: #fff; font-weight: bold; margin-left: 16rpx; padding: 8rpx 20rpx; background: #FFB74D; border-radius: 20rpx; }

.banner { padding: 0 20rpx; margin-top: 12rpx; }
.swiper { height: 240rpx; border-radius: 16rpx; overflow: hidden; }
.banner-card { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #FF6B35, #FF9A56); height: 100%; border-radius: 16rpx; padding: 28rpx; }
.banner-promo { flex-direction: column; justify-content: center; align-items: flex-start; background: linear-gradient(135deg, #FF7043, #FF8A65); }
.banner-promo-title { font-size: 36rpx; font-weight: bold; color: #fff; margin-bottom: 16rpx; }
.banner-promo-tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.promo-tag { font-size: 24rpx; color: rgba(255,255,255,0.95); background: rgba(0,0,0,0.15); padding: 8rpx 16rpx; border-radius: 20rpx; }
.banner-card2 { background: linear-gradient(135deg, #FF4757, #FF6B81); }
.banner-card3 { background: linear-gradient(135deg, #3498db, #2980b9); }
.banner-content { flex: 1; }
.banner-title { font-size: 32rpx; font-weight: bold; color: #fff; display: block; margin-bottom: 8rpx; }
.banner-sub { font-size: 22rpx; color: rgba(255,255,255,0.85); }
.banner-emoji { font-size: 72rpx; }

.category-grid { display: flex; flex-wrap: wrap; background: #fff; margin: 20rpx; border-radius: 20rpx; padding: 28rpx 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.category-grid-4 .category-grid-item { width: 25%; }
.category-grid-4 .category-grid-icon { width: 120rpx; height: 120rpx; border-radius: 24rpx; margin-bottom: 12rpx; }
.category-grid-4 .category-grid-emoji { font-size: 56rpx; }
.category-grid-4 .category-grid-name { font-size: 30rpx; font-weight: 500; }
.category-grid-item { width: 25%; display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.category-grid-icon { width: 80rpx; height: 80rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 8rpx; }
.category-grid-emoji { font-size: 40rpx; }
.category-grid-name { font-size: 22rpx; color: #333; text-align: center; }

.section { margin: 20rpx; background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; flex-wrap: wrap; }
.section-head-left { display: flex; flex-direction: column; }
.section-title { font-size: 32rpx; font-weight: bold; color: #333; }
.section-sub { font-size: 24rpx; color: #999; margin-top: 4rpx; }
.section-more { font-size: 26rpx; color: #FF6B35; }
.recommend-scroll { white-space: nowrap; margin: 0 -24rpx; }
.recommend-item { display: inline-block; width: 200rpx; margin-right: 20rpx; vertical-align: top; }
.recommend-img { width: 200rpx; height: 200rpx; background: #FFF5EE; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 12rpx; }
.recommend-emoji { font-size: 64rpx; }
.recommend-name { font-size: 26rpx; color: #333; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recommend-price { font-size: 28rpx; color: #FF6B35; font-weight: bold; margin-top: 6rpx; display: block; }

.coupon-row { display: flex; gap: 20rpx; margin: 20rpx; }
.coupon-card { flex: 1; background: linear-gradient(135deg, #FF6B6B, #EE5A5A); border-radius: 16rpx; padding: 20rpx; color: #fff; display: flex; justify-content: space-between; align-items: center; }
.coupon-card-left { display: flex; flex-direction: column; }
.coupon-value { font-size: 44rpx; font-weight: bold; display: inline; }
.coupon-unit { font-size: 22rpx; margin-left: 4rpx; }
.coupon-title { font-size: 22rpx; margin-top: 6rpx; opacity: 0.95; }
.coupon-desc { font-size: 22rpx; opacity: 0.9; margin-top: 4rpx; }
.coupon-expire { font-size: 20rpx; opacity: 0.8; margin-top: 6rpx; }
.coupon-btn { font-size: 24rpx; background: rgba(255,255,255,0.3); padding: 12rpx 24rpx; border-radius: 24rpx; }

.merchant-tabs { display: flex; gap: 24rpx; }
.merchant-tab { font-size: 26rpx; color: #666; }
.merchant-tab.active { color: #FF6B35; font-weight: bold; }
.section-merchants .section-head { align-items: flex-start; }
.merchant-list { margin: 0 -24rpx; }
.merchant-card { display: flex; padding: 24rpx; border-bottom: 1rpx solid #f5f5f5; }
.merchant-card:last-child { border-bottom: none; }
.merchant-card-img { width: 180rpx; height: 180rpx; background: #FFF5EE; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; flex-shrink: 0; }
.merchant-emoji { font-size: 64rpx; }
.merchant-card-body { flex: 1; min-width: 0; }
.merchant-name { font-size: 30rpx; font-weight: bold; color: #333; display: block; margin-bottom: 8rpx; }
.merchant-meta { display: flex; align-items: center; gap: 16rpx; margin-bottom: 8rpx; }
.merchant-score { font-size: 24rpx; color: #FF6B35; }
.merchant-sales { font-size: 22rpx; color: #999; }
.merchant-avg { font-size: 22rpx; color: #999; }
.merchant-delivery { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.delivery-tag { font-size: 20rpx; color: #FF6B35; background: #FFF5EE; padding: 4rpx 10rpx; border-radius: 6rpx; }
.delivery-dist { font-size: 22rpx; color: #999; }
.merchant-tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.tag { font-size: 20rpx; color: #999; }
.coupon-tag { color: #FF6B35; }
.merchant-cart { padding: 12rpx; }
.cart-icon { font-size: 40rpx; }

.sort-bar { display: flex; align-items: center; background: #f8f8f8; margin: 16rpx 0 20rpx; border-radius: 12rpx; padding: 16rpx 24rpx; }
.section .sort-bar { margin: 16rpx 0 20rpx; }
.sort-item { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 12rpx; }
.sort-item.active { background-color: #FFF5EE; }
.sort-text { font-size: 28rpx; color: #666; }
.sort-item.active .sort-text { color: #FF6B35; font-weight: bold; }

.section-header { margin-bottom: 20rpx; display: flex; justify-content: space-between; align-items: center; }
.clear-filter { font-size: 24rpx; color: #FF6B35; padding: 6rpx 16rpx; border: 1rpx solid #FF6B35; border-radius: 20rpx; }
.goods-item { display: flex; padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.goods-item:last-child { border-bottom: none; }
.goods-img-wrap { width: 160rpx; height: 160rpx; background: #FFF5EE; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; flex-shrink: 0; }
.goods-emoji { font-size: 70rpx; }
.goods-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.goods-name { font-size: 30rpx; font-weight: bold; color: #333; }
.goods-desc { font-size: 22rpx; color: #999; margin-top: 6rpx; }
.goods-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 10rpx; }
.goods-price { font-size: 34rpx; color: #FF6B35; font-weight: bold; }
.add-btn { width: 48rpx; height: 48rpx; background: linear-gradient(135deg, #FF6B35, #FF8C42); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.add-btn-text { color: #fff; font-size: 36rpx; font-weight: bold; line-height: 48rpx; }
.empty-goods { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 28rpx; color: #999; }
</style>
