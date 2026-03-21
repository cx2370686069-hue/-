<template>
  <view class="container">
    <view class="card search-bar">
      <input v-model="keyword" placeholder="搜索商品" class="search-input" @confirm="loadList" />
      <button class="btn-primary" @click="goEdit()">+ 添加商品</button>
    </view>

    <view v-if="list.length" class="product-list">
      <view v-for="item in list" :key="item.id" class="card product-item">
        <image class="product-img" :src="item.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='" mode="aspectFill" />
        <view class="product-info">
          <text class="name">{{ item.name }}</text>
          <text class="desc text-gray">{{ item.desc || '暂无描述' }}</text>
          <view class="flex-between">
            <text class="price primary-color">¥{{ item.price }}</text>
            <view class="actions">
              <text class="link" @click="toggleStatus(item)">{{ item.status === 1 ? '下架' : '上架' }}</text>
              <text class="link" @click="goEdit(item)">编辑</text>
              <text class="link danger" @click="deleteProduct(item)">删除</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <text>暂无商品，点击添加商品</text>
    </view>
  </view>
</template>

<script>
import { getProductList, updateProductStatus, deleteProduct as apiDelete } from '../../api/index.js';

export default {
  data() {
    return {
      keyword: '',
      list: []
    };
  },
  onLoad() {
    this.loadList();
  },
  methods: {
    async loadList() {
      try {
        const res = await getProductList({ keyword: this.keyword });
        this.list = res?.data?.list || [];
      } catch (e) {
        this.list = [
          { id: 1, name: '黄焖鸡米饭', desc: '经典黄焖鸡', price: '18.00', image: '', status: 1 },
          { id: 2, name: '酸辣土豆丝', desc: '家常小炒', price: '12.00', image: '', status: 1 }
        ];
      }
    },
    goEdit(item) {
      uni.navigateTo({ url: item ? `/pages/product/edit?id=${item.id}` : '/pages/product/edit' });
    },
    async toggleStatus(item) {
      const newStatus = item.status === 1 ? 0 : 1;
      try {
        await updateProductStatus(item.id, newStatus);
        uni.showToast({ title: newStatus === 1 ? '已上架' : '已下架' });
        this.loadList();
      } catch (e) {}
    },
    deleteProduct(item) {
      uni.showModal({
        title: '确认删除',
        content: `确定删除「${item.name}」吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await apiDelete(item.id);
              uni.showToast({ title: '已删除' });
              this.loadList();
            } catch (e) {}
          }
        }
      });
    }
  }
};
</script>

<style scoped>
.search-bar { display: flex; gap: 24rpx; align-items: center; }
.search-input { flex: 1; padding: 20rpx; background: #f5f5f5; border-radius: 12rpx; font-size: 28rpx; }
.product-item { display: flex; gap: 24rpx; margin-bottom: 24rpx; }
.product-img { width: 160rpx; height: 160rpx; border-radius: 12rpx; background: #f0f0f0; flex-shrink: 0; }
.product-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.name { font-size: 30rpx; font-weight: 600; }
.desc { font-size: 24rpx; margin: 8rpx 0; }
.price { font-size: 32rpx; font-weight: 600; }
.link { font-size: 24rpx; color: #FF6B35; margin-left: 24rpx; }
.link.danger { color: #f44336; }
.empty { text-align: center; padding: 80rpx; color: #999; }
</style>
