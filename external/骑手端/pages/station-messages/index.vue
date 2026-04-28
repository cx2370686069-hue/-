<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">跑腿代购消息</text>
      <text class="page-tip">仅显示当前乡镇站长的真实会话</text>
    </view>

    <view v-if="loading && conversations.length === 0" class="state-wrap">
      <text class="state-text">加载中...</text>
    </view>

    <view v-else-if="conversations.length === 0" class="state-wrap">
      <text class="state-text">暂无跑腿代购消息</text>
    </view>

    <view v-else class="conversation-list">
      <view
        v-for="item in conversations"
        :key="item.id"
        class="conversation-card"
        @click="openConversation(item)"
      >
        <view class="conversation-top">
          <view class="conversation-meta">
            <text class="user-name">{{ item.userName }}</text>
            <text class="town-name">{{ item.townName }}</text>
          </view>
          <text v-if="item.lastTime" class="time-text">{{ formatTime(item.lastTime) }}</text>
        </view>
        <view class="conversation-bottom">
          <text class="preview-text">{{ item.preview || '暂无消息内容' }}</text>
          <text v-if="item.unreadCount > 0" class="unread-badge">{{ item.unreadCount }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getTownErrandConversations } from '@/api/town-errand-message.js'
import { formatTime } from '@/utils/index.js'

function pickList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function pickConversationId(item = {}) {
  return item.id || item.conversation_id || item.conversationId || ''
}

function pickUserName(item = {}) {
  return item.user_nickname || item.userName || item.user_name || item.user?.nickname || item.user?.name || '用户'
}

function pickTownName(item = {}) {
  return item.town_name || item.townName || item.town || item.delivery_town || item.user_town || '未标注乡镇'
}

function pickPreview(item = {}) {
  const lastMessage = item.last_message || item.latest_message || {}
  return item.last_message_content || item.lastContent || lastMessage.content || ''
}

function pickLastTime(item = {}) {
  const lastMessage = item.last_message || item.latest_message || {}
  return item.last_message_time || item.updated_at || item.lastTime || lastMessage.created_at || item.created_at || ''
}

function pickUnreadCount(item = {}) {
  const unread = item.unread_count ?? item.unreadCount ?? item.unread_num
  return Number(unread) > 0 ? Number(unread) : 0
}

export default {
  data() {
    return {
      loading: false,
      conversations: [],
      conversationPollTimer: null
    }
  },
  onShow() {
    this.initConversationPolling()
  },
  onHide() {
    this.stopConversationPolling()
  },
  onUnload() {
    this.stopConversationPolling()
  },
  onPullDownRefresh() {
    this.loadConversations(false)
  },
  methods: {
    formatTime,
    async initConversationPolling() {
      await this.loadConversations(true)
      this.startConversationPolling()
    },
    async loadConversations(showLoading = true) {
      if (showLoading) {
        this.loading = true
      }
      try {
        const res = await getTownErrandConversations()
        const source = pickList(res?.data ?? res)
        this.conversations = source
          .map((item) => {
            const id = pickConversationId(item)
            if (!id) {
              return null
            }
            return {
              id,
              raw: item,
              userName: pickUserName(item),
              townName: pickTownName(item),
              preview: pickPreview(item),
              lastTime: pickLastTime(item),
              unreadCount: pickUnreadCount(item)
            }
          })
          .filter(Boolean)
      } catch (error) {
        console.error('加载镇上跑腿代购会话失败', error)
        this.conversations = []
      } finally {
        this.loading = false
        uni.stopPullDownRefresh()
      }
    },
    startConversationPolling() {
      this.stopConversationPolling()
      this.conversationPollTimer = setInterval(() => {
        this.loadConversations(false)
      }, 2000)
    },
    stopConversationPolling() {
      if (this.conversationPollTimer) {
        clearInterval(this.conversationPollTimer)
        this.conversationPollTimer = null
      }
    },
    openConversation(item) {
      const title = encodeURIComponent(item.userName || '会话详情')
      uni.navigateTo({
        url: `/pages/station-messages/detail?id=${item.id}&title=${title}`
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  box-sizing: border-box;
}

.page-header {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
}

.page-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #333333;
}

.page-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999999;
}

.state-wrap {
  padding: 180rpx 0;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: #999999;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.conversation-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.04);
}

.conversation-top,
.conversation-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
}

.conversation-bottom {
  margin-top: 16rpx;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.user-name {
  font-size: 30rpx;
  color: #333333;
  font-weight: 600;
}

.town-name {
  font-size: 22rpx;
  color: #1f6f43;
  background: rgba(31, 111, 67, 0.12);
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}

.time-text {
  font-size: 22rpx;
  color: #999999;
  flex-shrink: 0;
}

.preview-text {
  flex: 1;
  font-size: 26rpx;
  color: #666666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 10rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 999rpx;
  background: #ff4d4f;
  color: #ffffff;
  font-size: 22rpx;
  flex-shrink: 0;
}
</style>
