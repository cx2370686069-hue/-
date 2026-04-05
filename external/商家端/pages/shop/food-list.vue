<template>
  <view class="container">
    <view class="header">
      <view class="header-row">
        <button class="btn-cat" type="default" @click="goCategoryAdd">添加分类</button>
        <button class="btn-cat" type="default" @click="goCategoryManage">分类管理</button>
        <view class="search-bar" @click="noopSearch">
          <text class="search-icon">🔍</text>
          <text class="search-placeholder">搜索商品（敬请期待）</text>
        </view>
      </view>
      <view class="add-wrap">
        <button class="add-btn" type="default" @click="goPublish">添加商品</button>
      </view>
    </view>

    <view class="category-scroll">
      <scroll-view scroll-x class="category-list" :show-scrollbar="false">
        <view
          class="category-item"
          :class="{ 'category-active': currentCategoryId === 'all' }"
          @click="switchCategory('all')"
        >
          <text class="category-text">全部</text>
        </view>
        <view
          v-for="c in categoryList"
          :key="c.id"
          class="category-item"
          :class="{ 'category-active': currentCategoryId === c.id }"
          @click="switchCategory(c.id)"
        >
          <text class="category-text">{{ c.name }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="food-list" v-if="displayList.length > 0">
      <view class="food-card" v-for="item in displayList" :key="item.id">
        <view class="food-image" @click="previewImg(item)">
          <image v-if="item.image" class="img" :src="formatImageUrl(item.image)" mode="aspectFill" />
          <text v-else class="food-emoji">🍱</text>
        </view>
        <view class="food-info">
          <view class="food-header">
            <text class="food-name">{{ item.name }}</text>
            <view class="food-status" :class="{ off: item.status !== 1 }">
              <text class="status-text">{{ item.status === 1 ? '上架' : '下架' }}</text>
            </view>
          </view>
          <view class="food-footer">
            <view class="food-price-wrap">
              <text class="price-symbol">¥</text>
              <text class="food-price">{{ formatPrice(item.price) }}</text>
            </view>
            <text class="stock-text">库存 {{ item.stock }}</text>
          </view>
          <view class="food-actions">
            <button class="mini" size="mini" type="default" @click="toggleShelf(item)">
              {{ item.status === 1 ? '下架' : '上架' }}
            </button>
            <button class="mini primary" size="mini" type="default" @click="goEdit(item)">编辑</button>
            <button class="mini danger" size="mini" type="default" @click="handleDelete(item)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📦</text>
      <text class="empty-text">暂无商品</text>
      <button class="empty-btn" type="default" @click="goPublish">添加商品</button>
    </view>
  </view>
</template>

<script>
import { BASE_URL } from '@/config/index.js'
import request from '@/utils/request.js'
import { getMyProducts } from '@/api/shop.js'

export default {
  data() {
    return {
      categoryList: [],
      productList: [],
      currentCategoryId: 'all'
    }
  },
  computed: {
    displayList() {
      if (this.currentCategoryId === 'all') return this.productList
      const cid = Number(this.currentCategoryId)
      return this.productList.filter((p) => Number(p.category_id) === cid)
    }
  },
  onLoad() {
    this.bootstrap()
  },
  onShow() {
    this.bootstrap()
  },
  async onPullDownRefresh() {
    try {
      await this.bootstrap()
    } catch (e) {
      console.error(e)
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    async bootstrap() {
      await Promise.all([this.loadCategories(), this.loadProducts()])
    },
    normalizeCategories(res) {
      const arr =
        (res && res.data && Array.isArray(res.data.data) && res.data.data) ||
        (res && Array.isArray(res.data) && res.data) ||
        (res && Array.isArray(res) && res) ||
        []
      return arr
        .map((c) => ({
          id: c.id,
          name: c.name != null ? String(c.name) : ''
        }))
        .filter((c) => c.id != null)
    },
    normalizeProducts(res) {
      const raw = res && typeof res === 'object' && res.data !== undefined ? res.data : res
      const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.list) ? raw.list : []
      return arr.map((p) => ({
        id: p.id,
        name: p.name != null ? String(p.name) : '',
        price: p.price,
        stock: p.stock != null ? p.stock : p.inventory != null ? p.inventory : 0,
        status: p.status === 0 || p.status === 1 ? p.status : 0,
        category_id: p.category_id != null ? p.category_id : null,
        image: p.image || p.cover || p.cover_url || p.logo || ''
      }))
    },
    formatImageUrl(url) {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image') || url.startsWith('blob:')) {
        return url
      }
      return url.startsWith('/') ? BASE_URL + url : BASE_URL + '/' + url
    },
    async loadCategories() {
      try {
        const res = await request({ url: '/merchant/my-categories', method: 'GET' })
        this.categoryList = this.normalizeCategories(res)
      } catch (e) {
        this.categoryList = []
      }
    },
    async loadProducts() {
      try {
        const res = await getMyProducts({})
        this.productList = this.normalizeProducts(res)
      } catch (e) {
        this.productList = []
      }
    },
    formatPrice(v) {
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(2) : '--'
    },
    switchCategory(id) {
      this.currentCategoryId = id
    },
    noopSearch() {
      uni.showToast({ title: '搜索功能敬请期待', icon: 'none' })
    },
    goCategoryAdd() {
      uni.navigateTo({ url: '/pages/shop/category-add' })
    },
    goCategoryManage() {
      uni.navigateTo({ url: '/pages/shop/category-manage' })
    },
    goPublish() {
      uni.navigateTo({ url: '/pages/shop/product-publish' })
    },
    goEdit(item) {
      uni.navigateTo({ url: '/pages/shop/food-edit?id=' + item.id })
    },
    previewImg(item) {
      const u = this.formatImageUrl(item.image)
      if (!u) {
        uni.showToast({ title: '暂无图片', icon: 'none' })
        return
      }
      uni.previewImage({ urls: [u] })
    },
    async toggleShelf(item) {
      const next = item.status === 1 ? 0 : 1
      try {
        await request({
          url: '/merchant/product/' + item.id,
          method: 'PUT',
          data: { status: next }
        })
        uni.showToast({ title: next === 1 ? '已上架' : '已下架', icon: 'success' })
        await this.loadProducts()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    handleDelete(item) {
      uni.showModal({
        title: '删除商品',
        content: '确定删除「' + item.name + '」吗？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await request({ url: '/merchant/product/' + item.id, method: 'DELETE' })
            uni.showToast({ title: '已删除', icon: 'success' })
            await this.loadProducts()
          } catch (e) {
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}
.header {
  background-color: #fff;
  padding: 20rpx;
}
.header-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.btn-cat {
  flex-shrink: 0;
  font-size: 24rpx;
  padding: 0 20rpx;
  height: 64rpx;
  line-height: 64rpx;
  background: #fff7f2;
  color: #ff6b35;
  border: 1rpx solid #ffccb3;
  border-radius: 32rpx;
}
.search-bar {
  flex: 1;
  height: 64rpx;
  background-color: #f5f5f5;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
}
.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}
.search-placeholder {
  font-size: 24rpx;
  color: #999;
}
.add-wrap {
  margin-top: 20rpx;
}
.add-btn {
  width: 100%;
  background: linear-gradient(135deg, #ff6b35, #ff8f65);
  color: #fff;
  border: none;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.category-scroll {
  background-color: #fff;
  padding: 20rpx 0;
  margin-bottom: 16rpx;
}
.category-list {
  white-space: nowrap;
}
.category-item {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin: 0 10rpx;
  background-color: #f5f5f5;
  border-radius: 30rpx;
}
.category-item.category-active {
  background-color: #ff6b35;
}
.category-text {
  font-size: 26rpx;
  color: #666;
}
.category-item.category-active .category-text {
  color: #fff;
}
.food-list {
  padding: 0 20rpx;
}
.food-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: flex-start;
}
.food-image {
  width: 160rpx;
  height: 160rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.food-image .img {
  width: 100%;
  height: 100%;
}
.food-emoji {
  font-size: 64rpx;
}
.food-info {
  flex: 1;
  min-width: 0;
}
.food-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}
.food-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
  padding-right: 12rpx;
}
.food-status {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background-color: #f6ffed;
  flex-shrink: 0;
}
.food-status.off {
  background-color: #fff2f0;
}
.status-text {
  font-size: 22rpx;
  color: #52c41a;
}
.food-status.off .status-text {
  color: #ff4d4f;
}
.food-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.food-price-wrap {
  display: flex;
  align-items: baseline;
}
.price-symbol {
  font-size: 24rpx;
  color: #ff6b35;
  font-weight: bold;
}
.food-price {
  font-size: 34rpx;
  color: #ff6b35;
  font-weight: bold;
}
.stock-text {
  font-size: 24rpx;
  color: #999;
}
.food-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.food-actions .mini {
  font-size: 22rpx;
}
.food-actions .primary {
  background: #e6f7ff;
  color: #1890ff;
  border: 1rpx solid #91d5ff;
}
.food-actions .danger {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1rpx solid #ffccc7;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}
.empty-btn {
  background: #ff6b35;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  padding: 0 48rpx;
}
</style>
