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
      <view v-if="detail.status === 1" class="footer-actions">
        <button class="btn-primary" @click="acceptOrder">接单</button>
        <button class="btn-outline" @click="rejectOrder">拒单</button>
      </view>
      <view v-if="showSelfDeliveryMapButton" class="footer-actions">
        <button class="btn-primary" @click="openSelfDeliveryMap">配送地图</button>
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
    },
    showSelfDeliveryMapButton() {
      return !!(
        this.detail &&
        this.isSupermarketSelfDelivery(this.detail) &&
        (this.detail.status === 4 || this.detail.status === 5)
      )
    }
  },
  onLoad(opt) {
    this.orderId = opt?.id || '';
    this.loadDetail();
  },
  methods: {
    toCoordinateNumber(value) {
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    },
    getValidCoordinatePair(longitude, latitude) {
      const lng = this.toCoordinateNumber(longitude)
      const lat = this.toCoordinateNumber(latitude)
      if (lng == null || lat == null) return null
      if (lng === 0 && lat === 0) return null
      return { lng, lat }
    },
    formatDeliveryAddress(rawAddress) {
      if (!rawAddress) return ''
      if (typeof rawAddress === 'string') {
        const s = String(rawAddress).trim()
        const looksJson = (s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']')) || /"lng"|"lat"|"contact_phone"|"contact_name"/.test(s)
        try {
          const parsed = JSON.parse(s)
          if (parsed && typeof parsed === 'object') {
            const detail = parsed.detail != null ? String(parsed.detail).trim() : ''
            const address = parsed.address != null ? String(parsed.address).trim() : ''
            const town = parsed.town != null ? String(parsed.town).trim() : ''
            return detail || (town && address ? `${town}${address}` : address || town || '')
          }
        } catch (e) {
          if (!looksJson) return s
        }
        return looksJson ? '' : s
      }
      if (typeof rawAddress === 'object') {
        const detail = rawAddress.detail != null ? String(rawAddress.detail).trim() : ''
        const address = rawAddress.address != null ? String(rawAddress.address).trim() : ''
        const town = rawAddress.town != null ? String(rawAddress.town).trim() : ''
        return detail || (town && address ? `${town}${address}` : address || town || '')
      }
      return String(rawAddress)
    },
    isSupermarketSelfDelivery(detail) {
      if (!detail) return false
      const isSupermarket = String(detail.category || '').trim() === '超市'
      return isSupermarket && detail.supermarketDeliveryMode === 'self_delivery'
    },
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
      const customerPair = this.getValidCoordinatePair(
        raw?.customer_lng ?? raw?.delivery_longitude ?? raw?.longitude,
        raw?.customer_lat ?? raw?.delivery_latitude ?? raw?.latitude
      )
      const merchantPair = this.getValidCoordinatePair(raw?.merchant_lng, raw?.merchant_lat)
      return {
        id: raw?.id || raw?.order_id || this.orderId,
        status,
        statusText: ORDER_STATUS[status]?.text || '未知',
        orderNo: raw?.order_no || raw?.orderNo || '',
        createTime: raw?.created_at || raw?.createTime || '',
        deliveryTime: raw?.delivery_time || raw?.deliveryTime || '',
        receiver: raw?.contact_name || raw?.receiver || '',
        phone: raw?.contact_phone || raw?.phone || '',
        address: this.formatDeliveryAddress(raw?.delivery_address || raw?.address || ''),
        goodsList,
        totalAmount: raw?.pay_amount || raw?.total_amount || raw?.totalAmount || 0,
        category: raw?.category || raw?.merchant_category || raw?.shop_category || raw?.merchant?.category || raw?.shop?.category || '',
        supermarketDeliveryMode: raw?.supermarket_delivery_mode || '',
        supermarketDeliveryPermissionSnapshot: raw?.supermarket_delivery_permission_snapshot || '',
        customerLng: customerPair ? customerPair.lng : null,
        customerLat: customerPair ? customerPair.lat : null,
        merchantLng: merchantPair ? merchantPair.lng : null,
        merchantLat: merchantPair ? merchantPair.lat : null
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
    },
    openSelfDeliveryMap() {
      if (!this.detail) return
      if (this.detail.customerLng == null || this.detail.customerLat == null) {
        uni.showToast({ title: '订单缺少收货坐标，无法打开地图', icon: 'none' })
        return
      }
      const query = [
        'orderId=' + encodeURIComponent(String(this.detail.id || this.orderId || '')),
        'customerLng=' + encodeURIComponent(String(this.detail.customerLng)),
        'customerLat=' + encodeURIComponent(String(this.detail.customerLat)),
        'merchantLng=' + encodeURIComponent(String(this.detail.merchantLng == null ? '' : this.detail.merchantLng)),
        'merchantLat=' + encodeURIComponent(String(this.detail.merchantLat == null ? '' : this.detail.merchantLat)),
        'address=' + encodeURIComponent(String(this.detail.address || '').trim()),
        'phone=' + encodeURIComponent(String(this.detail.phone || '').trim())
      ].join('&')
      uni.navigateTo({ url: '/pages/order/self-delivery-nav?' + query })
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
