<template>
  <view class="container">
    <!-- 跑腿代购 进入后顶部 -->
    <view class="errand-header">
      <text class="errand-title">跑腿代购</text>
      <text class="errand-desc">同城取送 · 代购代办 · 快速送达</text>
    </view>

    <view class="tab-bar">
      <text :class="['tab-item', currentTab === 0 && 'tab-active']" @click="currentTab = 0">发布跑腿</text>
      <text :class="['tab-item', currentTab === 1 && 'tab-active']" @click="currentTab = 1; loadList()">我的跑腿</text>
    </view>

    <!-- 发布跑腿 -->
    <view class="publish-form" v-if="currentTab === 0">
      <view class="form-section">
        <view class="form-item">
          <text class="form-icon">📦</text>
          <text class="form-label">取件地址</text>
          <input class="form-input" v-model="form.pickupAddress" placeholder="如：城关镇中山大街XX号" />
        </view>
        <view class="form-item">
          <text class="form-icon">📍</text>
          <text class="form-label">收件地址</text>
          <input class="form-input" v-model="form.deliveryAddress" placeholder="如：秀水街道XX小区" />
        </view>
        <view class="form-item">
          <text class="form-icon">📋</text>
          <text class="form-label">物品类型</text>
          <picker :range="itemTypes" @change="onTypeChange" :value="typeIndex">
            <view class="picker-value">
              <text :class="form.itemType ? 'picker-text' : 'picker-placeholder'">{{ form.itemType || '请选择' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-icon">⏰</text>
          <text class="form-label">期望送达</text>
          <picker :range="timeOptions" @change="onTimeChange" :value="timeIndex">
            <view class="picker-value">
              <text :class="form.expectedTime ? 'picker-text' : 'picker-placeholder'">{{ form.expectedTime || '请选择' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-icon">💰</text>
          <text class="form-label">跑腿费</text>
          <input class="form-input" v-model="form.reward" placeholder="悬赏金额（元）" type="digit" />
        </view>
      </view>

      <view class="tip-section">
        <text class="tip-title">💡 温馨提示</text>
        <text class="tip-text">· 跑腿费越高，骑手接单越快</text>
        <text class="tip-text">· 请确保取件地址有人等候</text>
        <text class="tip-text">· 贵重物品请当面交接</text>
      </view>

      <view class="submit-bar">
        <view class="submit-btn" @click="handlePublish">
          <text class="submit-btn-text">发布跑腿订单</text>
        </view>
      </view>
    </view>

    <!-- 我的跑腿列表 -->
    <view class="list-section" v-if="currentTab === 1">
      <view v-if="errandList.length > 0">
        <view class="errand-card" v-for="item in errandList" :key="item.订单ID">
          <view class="errand-header">
            <text class="errand-id">{{ item.订单ID }}</text>
            <text :class="['errand-status', errandStatusClass(item.状态)]">{{ item.状态 }}</text>
          </view>
          <view class="errand-body">
            <view class="addr-row">
              <view class="addr-dot from"></view>
              <text class="addr-label">取</text>
              <text class="addr-value">{{ item.取件地址 }}</text>
            </view>
            <view class="addr-row">
              <view class="addr-dot to"></view>
              <text class="addr-label">送</text>
              <text class="addr-value">{{ item.收件地址 }}</text>
            </view>
          </view>
          <view class="errand-meta">
            <text class="meta-item">📋 {{ item.物品类型 }}</text>
            <text class="meta-item">⏰ {{ item.期望送达时间 }}</text>
            <text class="meta-price">💰 ¥{{ item.悬赏金额 }}</text>
          </view>
          <view class="errand-footer">
            <text class="errand-time">{{ item.创建时间 }}</text>
            <text class="errand-rider" v-if="item.骑手ID">骑手已接单</text>
          </view>
        </view>
      </view>
      <view class="empty" v-else>
        <text class="empty-icon">🏃</text>
        <text class="empty-text">暂无跑腿订单</text>
        <text class="empty-tip">去发布一个试试吧</text>
      </view>
    </view>
  </view>
</template>

<script>
import { publishErrand, getErrandList } from '@/api/errand.js'
import { requireLogin } from '@/utils/auth.js'

export default {
  data() {
    return {
      currentTab: 0,
      form: {
        pickupAddress: '',
        deliveryAddress: '',
        itemType: '',
        expectedTime: '',
        reward: ''
      },
      errandList: [],
      itemTypes: ['文件资料', '食品饮料', '生活用品', '药品', '鲜花', '数码产品', '其他'],
      typeIndex: 0,
      timeOptions: ['30分钟内', '1小时内', '2小时内', '今天内', '不急'],
      timeIndex: 0
    }
  },
  methods: {
    onTypeChange(e) {
      this.typeIndex = e.detail.value
      this.form.itemType = this.itemTypes[this.typeIndex]
    },
    onTimeChange(e) {
      this.timeIndex = e.detail.value
      this.form.expectedTime = this.timeOptions[this.timeIndex]
    },
    async handlePublish() {
      if (!requireLogin()) return
      if (!this.form.pickupAddress.trim()) {
        uni.showToast({ title: '请输入取件地址', icon: 'none' }); return
      }
      if (!this.form.deliveryAddress.trim()) {
        uni.showToast({ title: '请输入收件地址', icon: 'none' }); return
      }
      if (!this.form.itemType) {
        uni.showToast({ title: '请选择物品类型', icon: 'none' }); return
      }
      if (!this.form.expectedTime) {
        uni.showToast({ title: '请选择期望送达时间', icon: 'none' }); return
      }
      const reward = parseFloat(this.form.reward)
      if (!reward || reward <= 0) {
        uni.showToast({ title: '请输入跑腿费', icon: 'none' }); return
      }

      try {
        await publishErrand({
          pickupAddress: this.form.pickupAddress.trim(),
          deliveryAddress: this.form.deliveryAddress.trim(),
          itemType: this.form.itemType,
          expectedTime: this.form.expectedTime,
          reward: reward
        })
        uni.showToast({ title: '发布成功', icon: 'success' })
        this.form = { pickupAddress: '', deliveryAddress: '', itemType: '', expectedTime: '', reward: '' }
        this.currentTab = 1
        this.loadList()
      } catch (e) {}
    },
    async loadList() {
      if (!requireLogin()) return
      try {
        const res = await getErrandList()
        this.errandList = res.跑腿列表 || []
      } catch (e) {}
    },
    errandStatusClass(status) {
      const map = { '待接单': 'status-waiting', '配送中': 'status-delivering', '已完成': 'status-done' }
      return map[status] || ''
    }
  }
}
</script>

<style scoped>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.errand-header {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  padding: 36rpx 28rpx 28rpx;
  color: #fff;
}
.errand-title {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}
.errand-desc {
  font-size: 26rpx;
  opacity: 0.95;
}

.tab-bar {
  display: flex;
  background-color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 26rpx 0;
  font-size: 30rpx;
  color: #666;
  border-bottom: 4rpx solid transparent;
}
.tab-active {
  color: #FF6B35;
  font-weight: bold;
  border-bottom-color: #FF6B35;
}

.publish-form {
  padding-bottom: 140rpx;
}
.form-section {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 10rpx 24rpx;
}
.form-item {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.form-item:last-child {
  border-bottom: none;
}
.form-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.form-label {
  font-size: 28rpx;
  color: #333;
  width: 140rpx;
  flex-shrink: 0;
}
.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.picker-value {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.picker-text {
  font-size: 28rpx;
  color: #333;
}
.picker-placeholder {
  font-size: 28rpx;
  color: #999;
}
.picker-arrow {
  font-size: 36rpx;
  color: #ccc;
}

.tip-section {
  background-color: #FFF8F0;
  margin: 0 20rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.tip-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #FF6B35;
  display: block;
  margin-bottom: 12rpx;
}
.tip-text {
  font-size: 24rpx;
  color: #999;
  display: block;
  line-height: 1.8;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  background-color: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08);
}
.submit-btn {
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border-radius: 44rpx;
  padding: 24rpx 0;
  text-align: center;
}
.submit-btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
}

.list-section {
  padding: 16rpx 20rpx;
}
.errand-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.errand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.errand-id {
  font-size: 24rpx;
  color: #999;
}
.errand-status {
  font-size: 24rpx;
  font-weight: bold;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.status-waiting { color: #FF6B35; background-color: #FFF3EE; }
.status-delivering { color: #1890ff; background-color: #E6F7FF; }
.status-done { color: #52c41a; background-color: #F6FFED; }

.errand-body {
  margin-bottom: 16rpx;
}
.addr-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}
.addr-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.addr-dot.from {
  background-color: #FF6B35;
}
.addr-dot.to {
  background-color: #52c41a;
}
.addr-label {
  font-size: 22rpx;
  color: #fff;
  background-color: #999;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 6rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.addr-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

.errand-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.meta-item {
  font-size: 24rpx;
  color: #666;
}
.meta-price {
  font-size: 24rpx;
  color: #FF6B35;
  font-weight: bold;
}

.errand-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #f5f5f5;
}
.errand-time {
  font-size: 22rpx;
  color: #ccc;
}
.errand-rider {
  font-size: 24rpx;
  color: #1890ff;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}
.empty-icon {
  font-size: 80rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}
.empty-tip {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 10rpx;
}
</style>
