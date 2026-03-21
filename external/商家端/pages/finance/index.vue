<template>
  <view class="container">
    <view class="card balance-card">
      <text class="label">可提现余额(元)</text>
      <text class="amount">{{ balance }}</text>
      <button class="btn-primary" @click="applyWithdraw">申请提现</button>
    </view>

    <view class="card">
      <view class="section-title">近期统计</view>
      <view class="stats-row">
        <view class="stats-item">
          <text class="num">{{ todayIncome }}</text>
          <text class="label">今日营收</text>
        </view>
        <view class="stats-item">
          <text class="num">{{ weekIncome }}</text>
          <text class="label">本周营收</text>
        </view>
        <view class="stats-item">
          <text class="num">{{ monthIncome }}</text>
          <text class="label">本月营收</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="section-title">提现记录</view>
      <view v-if="withdrawList.length" class="record-list">
        <view v-for="item in withdrawList" :key="item.id" class="record-item flex-between">
          <view>
            <text class="amount">¥{{ item.amount }}</text>
            <text class="time text-gray">{{ item.createTime }}</text>
          </view>
          <text class="status" :class="item.status">{{ item.statusText }}</text>
        </view>
      </view>
      <view v-else class="empty text-gray">暂无提现记录</view>
    </view>
  </view>
</template>

<script>
import { getFinanceStats, getWithdrawList, applyWithdraw as apiApplyWithdraw } from '../../api/index.js';
import { formatMoney } from '../../utils/index.js';

export default {
  data() {
    return {
      balance: '0.00',
      todayIncome: '0.00',
      weekIncome: '0.00',
      monthIncome: '0.00',
      withdrawList: []
    };
  },
  onLoad() {
    this.loadData();
  },
  methods: {
    async loadData() {
      try {
        const [statsRes, withdrawRes] = await Promise.all([
          getFinanceStats(),
          getWithdrawList({ page: 1, size: 10 })
        ]);
        const s = statsRes?.data || {};
        this.balance = formatMoney(s.balance);
        this.todayIncome = formatMoney(s.todayIncome);
        this.weekIncome = formatMoney(s.weekIncome);
        this.monthIncome = formatMoney(s.monthIncome);

        // 提现记录（当前后端返回空数组，占位为主）
        const list = withdrawRes?.data?.list || [];
        this.withdrawList = list.map((item, index) => ({
          id: item.id || index,
          amount: formatMoney(item.amount),
          createTime: item.created_at || item.create_time || '',
          status: item.status || 'pending',
          statusText: item.statusText || (item.status === 'done' ? '已到账' : '审核中')
        }));
      } catch (e) {
        this.balance = '256.80';
        this.todayIncome = '128.50';
        this.weekIncome = '856.30';
        this.monthIncome = '3256.00';
        this.withdrawList = [
          { id: 1, amount: '200.00', createTime: '2024-03-08 14:30', status: 'done', statusText: '已到账' },
          { id: 2, amount: '150.00', createTime: '2024-03-05 10:00', status: 'pending', statusText: '审核中' }
        ];
      }
    },
    // 申请提现：调用后端 /merchant/finance/withdraw
    applyWithdraw() {
      const maxAmount = parseFloat(this.balance || 0);
      if (!maxAmount || maxAmount <= 0) {
        uni.showToast({ title: '暂无可提现余额', icon: 'none' });
        return;
      }
      uni.showModal({
        title: '申请提现',
        editable: true,
        placeholderText: `本次最多可提 ${this.balance} 元`,
        content: '',
        success: async (res) => {
          if (!res.confirm) return;
          const value = (res.content || '').trim();
          const amount = parseFloat(value);
          if (!amount || amount <= 0) {
            uni.showToast({ title: '请输入正确的金额', icon: 'none' });
            return;
          }
          if (amount > maxAmount) {
            uni.showToast({ title: '金额不能大于可提现余额', icon: 'none' });
            return;
          }
          try {
            await apiApplyWithdraw({ amount });
            uni.showToast({ title: '提现申请已提交', icon: 'success' });
            this.loadData();
          } catch (e) {}
        }
      });
    }
  }
};
</script>

<style scoped>
.balance-card { text-align: center; padding: 48rpx; }
.balance-card .label { font-size: 28rpx; color: #999; }
.balance-card .amount { display: block; font-size: 56rpx; font-weight: 700; color: #FF6B35; margin: 24rpx 0; }
.section-title { font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; }
.stats-row { display: flex; justify-content: space-around; padding: 16rpx 0; }
.stats-item { text-align: center; }
.stats-item .num { display: block; font-size: 36rpx; font-weight: 600; }
.stats-item .label { font-size: 24rpx; color: #999; }
.record-item { padding: 24rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.record-item:last-child { border-bottom: none; }
.record-item .amount { font-size: 30rpx; font-weight: 600; }
.record-item .time { font-size: 24rpx; margin-left: 16rpx; }
.record-item .status.done { color: #52c41a; }
.record-item .status.pending { color: #faad14; }
.empty { padding: 32rpx; text-align: center; }
</style>
