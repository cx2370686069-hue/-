<template>
  <view class="container">
    <view class="addr-list" v-if="addressList.length > 0">
      <view class="addr-item" v-for="item in addressList" :key="item.地址ID" @click="onSelectAddr(item)">
        <view class="addr-main">
          <view class="addr-top">
            <text class="addr-name">{{ item.收货人 }}</text>
            <text class="addr-phone">{{ item.联系电话 }}</text>
            <text class="default-tag" v-if="item.是否默认 === 1">默认</text>
          </view>
          <text class="addr-detail">{{ item.详细地址 }}</text>
        </view>
        <view class="addr-actions">
          <text class="action-btn" @click.stop="handleSetDefault(item)" v-if="item.是否默认 !== 1">设为默认</text>
          <text class="action-btn" @click.stop="editAddr(item)">编辑</text>
          <text class="action-btn delete-btn" @click.stop="handleDelete(item)">删除</text>
        </view>
      </view>
    </view>

    <view class="empty" v-else>
      <text class="empty-icon">📍</text>
      <text class="empty-text">暂无收货地址</text>
      <text class="empty-tip">点击下方按钮添加</text>
    </view>

    <view class="add-bar">
      <view class="add-btn" @click="addAddr">
        <text class="add-btn-text">+ 新增收货地址</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getAddressList, deleteAddress, setDefaultAddress } from '@/api/address.js'

export default {
  data() {
    return {
      addressList: [],
      selectMode: false
    }
  },
  onLoad(options) {
    if (options.select === '1') {
      this.selectMode = true
    }
  },
  onShow() {
    this.loadAddress()
  },
  methods: {
    async loadAddress() {
      try {
        const res = await getAddressList()
        this.addressList = res.地址列表 || []
      } catch (e) {}
    },
    onSelectAddr(item) {
      if (this.selectMode) {
        const pages = getCurrentPages()
        const prevPage = pages[pages.length - 2]
        if (prevPage) {
          prevPage.$vm.selectedAddress = item
        }
        uni.navigateBack()
      }
    },
    addAddr() {
      uni.navigateTo({ url: '/pages/address/edit' })
    },
    editAddr(item) {
      uni.navigateTo({ url: '/pages/address/edit?id=' + item.地址ID + '&data=' + encodeURIComponent(JSON.stringify(item)) })
    },
    async handleDelete(item) {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这个地址吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteAddress(item.地址ID)
              uni.showToast({ title: '已删除', icon: 'success' })
              this.loadAddress()
            } catch (e) {}
          }
        }
      })
    },
    async handleSetDefault(item) {
      try {
        await setDefaultAddress(item.地址ID)
        uni.showToast({ title: '已设为默认', icon: 'success' })
        this.loadAddress()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 140rpx;
}
.addr-list {
  padding: 20rpx;
}
.addr-item {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.addr-main {
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.addr-top {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}
.addr-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-right: 20rpx;
}
.addr-phone {
  font-size: 28rpx;
  color: #666;
}
.default-tag {
  font-size: 22rpx;
  color: #FF6B35;
  border: 1rpx solid #FF6B35;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  margin-left: 16rpx;
}
.addr-detail {
  font-size: 26rpx;
  color: #999;
  line-height: 1.5;
}
.addr-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16rpx;
}
.action-btn {
  font-size: 24rpx;
  color: #666;
  margin-left: 30rpx;
  padding: 6rpx 16rpx;
}
.delete-btn {
  color: #ff3b30;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}
.empty-icon {
  font-size: 100rpx;
}
.empty-text {
  font-size: 30rpx;
  color: #999;
  margin-top: 20rpx;
}
.empty-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 10rpx;
}

.add-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  background-color: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
}
.add-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 24rpx 0;
  text-align: center;
}
.add-btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}
</style>
