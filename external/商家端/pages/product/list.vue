<template>
  <view class="container">
    <view class="card toolbar">
      <input v-model="keyword" class="search-input" placeholder="搜索商品名称" />
      <button class="btn-light" type="default" @click="openCategoryDialog">新增分类</button>
      <button class="btn-primary" type="default" @click="goAddProduct">添加商品</button>
    </view>

    <view class="card category-card">
      <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
        <view
          class="category-item"
          :class="{ active: selectedCategoryId === 'all' }"
          @click="selectedCategoryId = 'all'"
        >
          全部
        </view>
        <view
          v-for="c in categories"
          :key="c.id"
          class="category-item"
          :class="{ active: String(selectedCategoryId) === String(c.id) }"
          @click="selectedCategoryId = c.id"
        >
          {{ c.name }}
        </view>
      </scroll-view>
    </view>

    <view v-if="filteredList.length" class="product-list">
      <view v-for="item in filteredList" :key="item.id" class="card product-item">
        <view class="product-img-wrap">
          <image v-if="item.image" class="product-img" :src="formatImageUrl(item.image)" mode="aspectFill" />
          <text v-else class="product-img-ph">无图</text>
        </view>
        <view class="product-info">
          <text class="name">{{ item.name }}</text>
          <text class="desc">{{ item.description || '暂无描述' }}</text>
          <view class="price-row">
            <text class="price">¥{{ formatPrice(item.price) }}</text>
            <text v-if="item.original_price" class="original-price">¥{{ formatPrice(item.original_price) }}</text>
          </view>
          <view class="status-row">
            <text class="stock">库存: {{ item.stock }}</text>
            <text :class="['status-tag', item.status === 1 ? 'on' : 'off']">{{ item.status === 1 ? '上架中' : '已下架' }}</text>
          </view>
          <view class="actions">
            <text class="link" @click="toggleStatus(item)">{{ item.status === 1 ? '下架' : '上架' }}</text>
            <text class="link" @click="goEdit(item)">编辑</text>
            <text class="link danger" @click="deleteProduct(item)">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <text class="empty-title">暂无商品</text>
      <text class="empty-hint">请点击上方「添加商品」发布</text>
    </view>

    <view v-if="categoryDialogVisible" class="mask" @click.self="closeCategoryDialog">
      <view class="dialog" @click.stop>
        <text class="dialog-title">新增分类</text>
        <input
          v-model="newCategoryName"
          class="dialog-input"
          placeholder="请输入分类名称"
          placeholder-class="ph"
        />
        <view class="dialog-actions">
          <button class="dialog-btn ghost" type="default" @click="closeCategoryDialog">取消</button>
          <button class="dialog-btn primary" type="default" :loading="categorySubmitting" @click="submitCategory">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { BASE_URL } from '@/config/index.js'
import {
  getMyProducts,
  getMerchantCategoryList,
  createCategory,
  updateProduct,
  deleteProduct as removeMerchantProduct
} from '@/api/shop.js'

export default {
  data() {
    return {
      keyword: '',
      list: [],
      categories: [],
      selectedCategoryId: 'all',
      categoryDialogVisible: false,
      categorySubmitting: false,
      newCategoryName: ''
    }
  },
  computed: {
    filteredList() {
      const kw = (this.keyword || '').trim().toLowerCase()
      return this.list.filter((item) => {
        const byCategory =
          this.selectedCategoryId === 'all' ||
          String(item.category_id) === String(this.selectedCategoryId)
        const byKeyword = !kw || String(item.name || '').toLowerCase().includes(kw)
        return byCategory && byKeyword
      })
    }
  },
  onLoad() {
    this.loadData()
    uni.$on('refreshProductList', this.onRefreshProductList)
  },
  onUnload() {
    uni.$off('refreshProductList', this.onRefreshProductList)
  },
  onShow() {
    this.loadData()
  },
  async onPullDownRefresh() {
    try {
      await this.loadData()
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  methods: {
    onRefreshProductList() {
      this.loadData()
    },
    async loadData() {
      await Promise.all([this.loadCategories(), this.loadProducts()])
    },
    formatImageUrl(url) {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image') || url.startsWith('blob:')) {
        return url
      }
      return url.startsWith('/') ? BASE_URL + url : BASE_URL + '/' + url
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
        original_price: p.original_price,
        stock: p.stock != null ? p.stock : p.inventory != null ? p.inventory : 0,
        status: p.status === 0 || p.status === 1 ? p.status : 0,
        description: p.description != null ? String(p.description) : '',
        category_id: p.category_id,
        image: p.image || p.cover || p.cover_url || ''
      }))
    },
    async loadCategories() {
      try {
        const res = await getMerchantCategoryList()
        this.categories = this.normalizeCategories(res)
        const exists =
          this.selectedCategoryId === 'all' ||
          this.categories.some((c) => String(c.id) === String(this.selectedCategoryId))
        if (!exists) this.selectedCategoryId = 'all'
      } catch (e) {
        this.categories = []
        this.selectedCategoryId = 'all'
      }
    },
    async loadProducts() {
      try {
        const res = await getMyProducts({})
        this.list = this.normalizeProducts(res)
      } catch (e) {
        this.list = []
      }
    },
    formatPrice(v) {
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(2) : '--'
    },
    openCategoryDialog() {
      this.newCategoryName = ''
      this.categoryDialogVisible = true
    },
    closeCategoryDialog() {
      this.categoryDialogVisible = false
      this.newCategoryName = ''
    },
    async submitCategory() {
      const name = (this.newCategoryName || '').trim()
      if (!name) {
        uni.showToast({ title: '请输入分类名称', icon: 'none' })
        return
      }
      this.categorySubmitting = true
      try {
        await createCategory({ name, sort: 1 })
        uni.showToast({ title: '创建成功', icon: 'success' })
        this.closeCategoryDialog()
        await this.loadCategories()
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '创建失败', icon: 'none' })
      } finally {
        this.categorySubmitting = false
      }
    },
    goAddProduct() {
      uni.navigateTo({ url: '/pages/shop/product-publish' })
    },
    goEdit(item) {
      uni.navigateTo({ url: `/pages/shop/food-edit?id=${item.id}` })
    },
    async toggleStatus(item) {
      const newStatus = item.status === 1 ? 0 : 1
      try {
        await updateProduct(item.id, { status: newStatus })
        uni.showToast({ title: newStatus === 1 ? '已上架' : '已下架' })
        await this.loadProducts()
      } catch (e) {}
    },
    deleteProduct(item) {
      uni.showModal({
        title: '确认删除',
        content: `确定删除「${item.name}」吗？`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await removeMerchantProduct(item.id)
            uni.showToast({ title: '已删除', icon: 'success' })
            await this.loadProducts()
          } catch (e) {}
        }
      })
    }
  }
}
</script>

<style scoped>
.container { padding: 20rpx; background: #f5f5f5; min-height: 100vh; box-sizing: border-box; }
.toolbar { display: flex; gap: 16rpx; align-items: center; }
.search-input { flex: 1; height: 72rpx; background: #f5f5f5; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; }
.btn-light { font-size: 24rpx; height: 72rpx; line-height: 72rpx; border-radius: 12rpx; }
.btn-primary { font-size: 24rpx; height: 72rpx; line-height: 72rpx; border-radius: 12rpx; background: #ff6b35; color: #fff; border: none; }
.category-card { margin-top: 16rpx; }
.category-scroll { white-space: nowrap; }
.category-item { display: inline-block; padding: 12rpx 24rpx; margin-right: 12rpx; border-radius: 28rpx; background: #f5f5f5; color: #666; font-size: 24rpx; }
.category-item.active { background: #ff6b35; color: #fff; }
.product-list { margin-top: 20rpx; }
.product-item { display: flex; gap: 20rpx; margin-bottom: 20rpx; }
.product-img-wrap { width: 160rpx; height: 160rpx; border-radius: 12rpx; background: #f0f0f0; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.product-img { width: 100%; height: 100%; }
.product-img-ph { font-size: 24rpx; color: #bbb; }
.product-info { flex: 1; min-width: 0; }
.name { font-size: 30rpx; font-weight: 600; color: #333; }
.desc { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.price-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 10rpx; }
.price { font-size: 32rpx; color: #ff6b35; font-weight: 600; }
.original-price { font-size: 24rpx; color: #bbb; text-decoration: line-through; }
.status-row { margin-top: 10rpx; display: flex; justify-content: space-between; align-items: center; }
.stock { font-size: 24rpx; color: #666; }
.status-tag { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 4rpx; }
.status-tag.on { background: #e6f7e6; color: #52c41a; }
.status-tag.off { background: #f5f5f5; color: #999; }
.actions { margin-top: 12rpx; display: flex; gap: 16rpx; }
.link { font-size: 24rpx; color: #ff6b35; }
.link.danger { color: #f44336; }
.empty { text-align: center; padding: 120rpx 20rpx; color: #999; display: flex; flex-direction: column; gap: 16rpx; }
.empty-title { font-size: 30rpx; color: #666; }
.empty-hint { font-size: 26rpx; color: #999; }
.mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; padding: 32rpx; z-index: 100; }
.dialog { width: 100%; max-width: 620rpx; background: #fff; border-radius: 16rpx; padding: 32rpx; box-sizing: border-box; }
.dialog-title { font-size: 32rpx; color: #333; font-weight: 600; display: block; margin-bottom: 20rpx; }
.dialog-input { height: 80rpx; border: 1rpx solid #ddd; border-radius: 10rpx; padding: 0 20rpx; font-size: 28rpx; }
.ph { color: #bbb; }
.dialog-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.dialog-btn { flex: 1; border-radius: 10rpx; font-size: 28rpx; }
.dialog-btn.ghost { background: #f5f5f5; color: #666; }
.dialog-btn.primary { background: #ff6b35; color: #fff; border: none; }
</style>
