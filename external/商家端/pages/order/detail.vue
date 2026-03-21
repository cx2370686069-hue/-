<template>
  <view class="container">
    <view v-if="detail" class="card">
      <view class="detail-row">
        <text class="label">订单状态</text>
        <text class="value status-tag" :style="{ color: statusColor }">{{ detail.statusText }}</text>
      </view>
      <view class="detail-row">
        <text class="label">订单号</text>
        <text class="value">{{ detail.orderNo }}</text>
      </view>
      <view class="detail-row">
        <text class="label">下单时间</text>
        <text class="value">{{ detail.createTime }}</text>
      </view>
      <view class="detail-row">
        <text class="label">预计送达</text>
        <text class="value">{{ detail.deliveryTime }}</text>
      </view>
      <view class="divider" />
      <view class="detail-row">
        <text class="label">收货人</text>
        <text class="value">{{ detail.receiver }} {{ detail.phone }}</text>
      </view>
      <view class="detail-row">
        <text class="label">配送地址</text>
        <text class="value">{{ detail.address }}</text>
      </view>
      <view class="divider" />
      <view class="goods-section">
        <view class="section-title">商品明细</view>
        <view v-for="(g, i) in detail.goodsList" :key="i" class="goods-item flex-between">
          <text>{{ g.name }} x{{ g.num }}</text>
          <text>¥{{ g.price }}</text>
        </view>
      </view>
      <view class="detail-row">
        <text class="label">订单金额</text>
        <text class="value primary-color text-bold">¥{{ detail.totalAmount }}</text>
      </view>
      <view v-if="detail.status === 0" class="footer-actions">
        <button class="btn-primary" @click="acceptOrder">接单</button>
        <button class="btn-outline" @click="rejectOrder">拒单</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getOrderDetail, acceptOrder as apiAccept, rejectOrder as apiReject } from '../../api/index.js';
import { ORDER_STATUS } from '../../utils/index.js';

export default {
  data() {
    return {
      orderId: '',
      detail: null
    };
  },
  computed: {
    statusColor() {
      return this.detail ? (ORDER_STATUS[this.detail.status]?.color || '#999') : '#999';
    }
  },
  onLoad(opt) {
    this.orderId = opt?.id || '';
    this.loadDetail();
  },
  methods: {
    async loadDetail() {
      try {
        const res = await getOrderDetail(this.orderId);
        this.detail = res?.data || {};
        this.detail.statusText = ORDER_STATUS[this.detail.status]?.text || '未知';
      } catch (e) {
        this.detail = {
          orderNo: '202403090001',
          status: 0,
          statusText: '待接单',
          createTime: '2024-03-09 12:30',
          deliveryTime: '12:50',
          receiver: '张三',
          phone: '138****8888',
          address: '固始县XX路XX号',
          goodsList: [{ name: '黄焖鸡米饭', num: 2, price: '35.80' }],
          totalAmount: '35.80'
        };
      }
    },
    async acceptOrder() {
      try {
        await apiAccept(this.orderId);
        uni.showToast({ title: '接单成功' });
        this.loadDetail();
      } catch (e) {}
    },
    rejectOrder() {
      uni.showModal({
        title: '拒单',
        content: '确定拒单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await apiReject(this.orderId, { reason: '商品已售罄' });
              uni.showToast({ title: '已拒单' });
              uni.navigateBack();
            } catch (e) {}
          }
        }
      });
    }
  }
};
</script>

<style scoped>
.detail-row { display: flex; justify-content: space-between; padding: 20rpx 0; font-size: 28rpx; }
.label { color: #999; }
.value { flex: 1; margin-left: 24rpx; text-align: right; }
.status-tag { font-weight: 600; }
.divider { height: 1rpx; background: #eee; margin: 16rpx 0; }
.goods-section { padding: 16rpx 0; }
.section-title { font-size: 28rpx; font-weight: 600; margin-bottom: 16rpx; }
.goods-item { padding: 12rpx 0; font-size: 26rpx; }
.footer-actions { display: flex; gap: 24rpx; margin-top: 32rpx; }
.btn-outline { background: transparent; border: 1rpx solid #ddd; color: #666; }
</style>
