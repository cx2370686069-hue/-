<template>
  <view class="container">
    <view class="card form">
      <view class="form-item">
        <text class="label">商品名称</text>
        <input v-model="form.name" placeholder="请输入商品名称" />
      </view>
      <view class="form-item">
        <text class="label">商品描述</text>
        <textarea v-model="form.desc" placeholder="请输入商品描述" />
      </view>
      <view class="form-item">
        <text class="label">售价(元)</text>
        <input v-model="form.price" type="digit" placeholder="0.00" />
      </view>
      <view class="form-item">
        <text class="label">分类</text>
        <input v-model="form.category" placeholder="如：主食、小吃" />
      </view>
      <view class="form-item">
        <text class="label">商品图片</text>
        <view class="img-upload" @click="chooseImage">
          <image v-if="form.image" :src="form.image" class="preview" mode="aspectFill" />
          <text v-else class="placeholder">+ 添加图片</text>
        </view>
      </view>
      <button class="btn-primary full" @click="submit">保存</button>
    </view>
  </view>
</template>

<script>
import { getProductDetail, createProduct, updateProduct } from '../../api/index.js';

export default {
  data() {
    return {
      id: '',
      form: {
        name: '',
        desc: '',
        price: '',
        category: '',
        image: ''
      }
    };
  },
  onLoad(opt) {
    this.id = opt?.id || '';
    if (this.id) this.loadDetail();
  },
  methods: {
    async loadDetail() {
      try {
        const res = await getProductDetail(this.id);
        this.form = { ...this.form, ...res?.data };
      } catch (e) {
        this.form = { name: '', desc: '', price: '', category: '', image: '' };
      }
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.form.image = res.tempFilePaths[0];
        }
      });
    },
    async submit() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入商品名称', icon: 'none' });
        return;
      }
      if (!this.form.price) {
        uni.showToast({ title: '请输入售价', icon: 'none' });
        return;
      }
      try {
        if (this.id) {
          await updateProduct(this.id, this.form);
          uni.showToast({ title: '修改成功' });
        } else {
          await createProduct(this.form);
          uni.showToast({ title: '添加成功' });
        }
        setTimeout(() => uni.navigateBack(), 1500);
      } catch (e) {}
    }
  }
};
</script>

<style scoped>
.form-item { margin-bottom: 32rpx; }
.label { display: block; font-size: 28rpx; margin-bottom: 12rpx; color: #666; }
input, textarea {
  width: 100%;
  padding: 24rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
textarea { min-height: 120rpx; }
.img-upload {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview { width: 100%; height: 100%; border-radius: 12rpx; }
.placeholder { color: #999; font-size: 24rpx; }
.full { width: 100%; margin-top: 24rpx; }
</style>
