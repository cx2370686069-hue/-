<template>
  <view class="container">
    <view v-if="list.length" class="review-list">
      <view v-for="item in list" :key="item.id" class="card review-item">
        <view class="review-header flex-between">
          <view class="user-info">
            <text class="avatar">{{ (item.userName || '用户').charAt(0) }}</text>
            <view>
              <text class="user-name">{{ item.userName || '匿名用户' }}</text>
              <view class="star-wrap">
                <text v-for="n in 5" :key="n" class="star" :class="{ active: n <= item.rating }">★</text>
              </view>
            </view>
          </view>
          <text class="time text-gray">{{ item.createTime }}</text>
        </view>
        <view class="review-content">{{ item.content }}</view>
        <view v-if="item.reply" class="reply-box">
          <text class="reply-label">商家回复：</text>
          <text>{{ item.reply }}</text>
        </view>
        <view v-else class="reply-btn">
          <button class="btn-small" @click="showReply(item)">回复</button>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <text>暂无评价</text>
    </view>

    <!-- 回复弹窗 -->
    <view v-if="replyVisible" class="reply-mask" @click="replyVisible = false">
      <view class="reply-dialog" @click.stop>
        <text class="dialog-title">回复评价</text>
        <textarea v-model="replyContent" placeholder="请输入回复内容" class="reply-input" />
        <view class="dialog-actions">
          <button @click="replyVisible = false">取消</button>
          <button class="btn-primary" @click="submitReply">提交</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getReviewList, replyReview } from '../../api/index.js';

export default {
  data() {
    return {
      list: [],
      replyVisible: false,
      replyContent: '',
      currentReview: null
    };
  },
  onLoad() {
    this.loadList();
  },
  methods: {
    async loadList() {
      try {
        const res = await getReviewList({ page: 1, size: 20 });
        this.list = res?.data?.list || [];
      } catch (e) {
        this.list = [
          { id: 1, userName: '李**', rating: 5, content: '味道很好，送餐也快！', createTime: '2024-03-09 12:30', reply: '' },
          { id: 2, userName: '王**', rating: 4, content: '不错，下次还点', createTime: '2024-03-08 18:20', reply: '感谢您的支持！' }
        ];
      }
    },
    showReply(item) {
      this.currentReview = item;
      this.replyContent = '';
      this.replyVisible = true;
    },
    async submitReply() {
      if (!this.replyContent.trim()) {
        uni.showToast({ title: '请输入回复内容', icon: 'none' });
        return;
      }
      try {
        await replyReview(this.currentReview.id, { content: this.replyContent });
        uni.showToast({ title: '回复成功' });
        this.replyVisible = false;
        this.loadList();
      } catch (e) {}
    }
  }
};
</script>

<style scoped>
.review-header { margin-bottom: 16rpx; }
.user-info { display: flex; align-items: center; gap: 16rpx; }
.avatar {
  width: 64rpx;
  height: 64rpx;
  background: #FF6B35;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.user-name { font-size: 28rpx; font-weight: 500; }
.star-wrap { margin-top: 4rpx; }
.star { color: #ddd; font-size: 24rpx; }
.star.active { color: #ffc107; }
.review-content { font-size: 28rpx; line-height: 1.6; color: #333; margin-bottom: 16rpx; }
.reply-box {
  background: #f8f8f8;
  padding: 16rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
}
.reply-label { color: #FF6B35; margin-right: 8rpx; }
.reply-btn { margin-top: 16rpx; }
.btn-small { font-size: 24rpx; padding: 12rpx 24rpx; background: #f5f5f5; }
.empty { text-align: center; padding: 80rpx; color: #999; }
.reply-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.reply-dialog {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  width: 600rpx;
}
.dialog-title { font-size: 32rpx; font-weight: 600; display: block; margin-bottom: 24rpx; }
.reply-input {
  width: 100%;
  min-height: 120rpx;
  padding: 20rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}
.dialog-actions { display: flex; justify-content: flex-end; gap: 24rpx; }
</style>
