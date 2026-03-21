<template>
  <view class="container">
    <view class="form-section">
      <view class="form-item">
        <text class="form-label">商品名称</text>
        <input 
          class="form-input" 
          v-model="formData.商品名称" 
          placeholder="请输入商品名称"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">商品价格</text>
        <input 
          class="form-input" 
          v-model="formData.价格" 
          type="digit"
          placeholder="请输入价格"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">商品分类</text>
        <picker 
          class="picker" 
          :range="categories" 
          range-key="name"
          @change="onCategoryChange"
        >
          <view class="picker-value">
            {{ formData.分类 || '请选择分类' }}
          </view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">库存数量</text>
        <input 
          class="form-input" 
          v-model="formData.库存" 
          type="number"
          placeholder="请输入库存数量"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">商品描述</text>
        <textarea 
          class="form-textarea" 
          v-model="formData.描述" 
          placeholder="请输入商品描述"
          placeholder-class="input-placeholder"
          maxlength="200"
        />
      </view>

      <view class="form-item">
        <text class="form-label">商品图片</text>
        <view class="image-upload" @click="chooseImage">
          <view class="upload-box" v-if="!formData.图片">
            <text class="upload-icon">📷</text>
            <text class="upload-text">点击上传图片</text>
          </view>
          <image v-else :src="formData.图片" mode="aspectFill" class="upload-image" />
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">商品状态</text>
        <view class="switch-wrap">
          <switch 
            :checked="formData.状态 === 1" 
            @change="onStatusChange"
            color="#FF6B35"
          />
          <text class="switch-text">{{ formData.状态 === 1 ? '在售' : '售罄' }}</text>
        </view>
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">
      <text class="submit-btn-text">{{ isEdit ? '保存修改' : '添加商品' }}</text>
    </view>
  </view>
</template>

<script>
import { addFood, updateFood, getFoodDetail } from '@/api/food.js'

export default {
  data() {
    return {
      foodId: '',
      isEdit: false,
      formData: {
        商品名称： '',
        价格： '',
        分类： '',
        库存： '',
        描述： '',
        图片： '',
        状态： 1
      },
      categories: [
        { id: 1, name: '主食' },
        { id: 2, name: '小吃' },
        { id: 3, name: '饮料' },
        { id: 4, name: '甜点' },
        { id: 5, name: '套餐' }
      ]
    }
  },
  onLoad(options) {
    if (options.id) {
      this.foodId = options.id
      this.isEdit = true
      this.loadFoodDetail()
    }
  },
  methods: {
    async loadFoodDetail() {
      try {
        const res = await getFoodDetail(this.foodId)
        if (res) {
          this.formData = {
            商品名称：res.商品名称 || '',
            价格：res.价格 || '',
            分类：res.分类 || '',
            库存：res.库存 || '',
            描述：res.描述 || '',
            图片：res.图片 || '',
            状态：res.状态 !== undefined ? res.状态 : 1
          }
        }
      } catch (e) {
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },
    onCategoryChange(e) {
      const index = e.detail.value
      this.formData.分类 = this.categories[index].name
    },
    onStatusChange(e) {
      this.formData.状态 = e.detail.value ? 1 : 0
    },
    chooseImage() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.formData.图片 = res.tempFilePaths[0]
        }
      })
    },
    async handleSubmit() {
      if (!this.formData.商品名称) {
        uni.showToast({
          title: '请输入商品名称',
          icon: 'none'
        })
        return
      }
      if (!this.formData.价格) {
        uni.showToast({
          title: '请输入商品价格',
          icon: 'none'
        })
        return
      }
      if (!this.formData.分类) {
        uni.showToast({
          title: '请选择商品分类',
          icon: 'none'
        })
        return
      }

      try {
        if (this.isEdit) {
          await updateFood(this.foodId, this.formData)
          uni.showToast({
            title: '修改成功',
            icon: 'success'
          })
        } else {
          await addFood(this.formData)
          uni.showToast({
            title: '添加成功',
            icon: 'success'
          })
        }
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (e) {
        uni.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #F5F5F5;
  padding: 20rpx;
  padding-bottom: 140rpx;
}

.form-section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
}

.form-item {
  padding: 30rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 80rpx;
  font-size: 28rpx;
  color: #333;
}

.input-placeholder {
  color: #999;
}

.form-textarea {
  width: 100%;
  height: 200rpx;
  font-size: 28rpx;
  color: #333;
}

.picker {
  height: 80rpx;
  display: flex;
  align-items: center;
}

.picker-value {
  font-size: 28rpx;
  color: #333;
}

.image-upload {
  width: 100%;
}

.upload-box {
  width: 200rpx;
  height: 200rpx;
  background-color: #F5F5F5;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed #ddd;
}

.upload-icon {
  font-size: 60rpx;
  margin-bottom: 12rpx;
}

.upload-text {
  font-size: 24rpx;
  color: #999;
}

.upload-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
}

.switch-wrap {
  display: flex;
  align-items: center;
}

.switch-text {
  font-size: 28rpx;
  color: #333;
  margin-left: 16rpx;
}

.submit-btn {
  position: fixed;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 600rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #FF6B35 0%, #FF8F65 100%);
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.4);
}

.submit-btn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}
</style>
