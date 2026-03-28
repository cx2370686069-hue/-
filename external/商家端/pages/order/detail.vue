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
    formatDetail(raw) {
      let goodsList = []
      try {
        if (raw?.products_info) {
          const parsed = typeof raw.products_info === 'string' ? JSON.parse(raw.products_info) : raw.products_info
          goodsList = (parsed || []).map((g) => ({
            name: g.name || g.商品名称 || '',
            num: g.num || g.数量 || 1,
            price: g.price || g.价格 || 0
          }))
        } else if (Array.isArray(raw?.goodsList)) {
          goodsList = raw.goodsList
        }
      } catch (e) {
        goodsList = []
      }

      const status = Number(raw?.status ?? -1)
      return {
        id: raw?.id || raw?.order_id || this.orderId,
        status,
        statusText: ORDER_STATUS[status]?.text || '未知',
        orderNo: raw?.order_no || raw?.orderNo || '',
        createTime: raw?.created_at || raw?.createTime || '',
        deliveryTime: raw?.delivery_time || raw?.deliveryTime || '',
        receiver: raw?.contact_name || raw?.receiver || '',
        phone: raw?.contact_phone || raw?.phone || '',
        address: raw?.delivery_address || raw?.address || '',
        goodsList,
        totalAmount: raw?.pay_amount || raw?.total_amount || raw?.totalAmount || 0
      }
    },
    async loadDetail() {
      try {
        const res = await getOrderDetail(this.orderId);
        const raw = res?.data || res || {};
        this.detail = this.formatDetail(raw);
        this.orderId = this.detail.id || this.orderId;
      } catch (e) {
        this.detail = null;
        uni.showToast({ title: '加载订单详情失败', icon: 'none' });
      }
    },
    async acceptOrder() {
      try {
        const realOrderId = Number(this.detail?.id || this.detail?.order_id || this.orderId)
        if (!realOrderId || isNaN(realOrderId)) {
          uni.showToast({ title: '订单ID无效', icon: 'none' })
          return
        }
        await apiAccept(realOrderId, {
          merchant_lng: 115.681123,
          merchant_lat: 32.181234
        });
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
