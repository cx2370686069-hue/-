<template>
  <view class="page">
    <view class="chat-header">
      <text class="chat-title">{{ pageTitle }}</text>
      <text class="chat-tip">仅支持文字回复，消息均来自真实接口</text>
    </view>

    <scroll-view
      class="message-scroll"
      scroll-y
      :scroll-into-view="scrollAnchor"
    >
      <view v-if="loading && messages.length === 0" class="state-wrap">
        <text class="state-text">加载中...</text>
      </view>

      <view v-else-if="messages.length === 0" class="state-wrap">
        <text class="state-text">暂无消息</text>
      </view>

      <view v-else class="message-list">
        <view
          v-for="item in messages"
          :id="`msg-${item.id}`"
          :key="item.id"
          class="message-row"
          :class="{ mine: item.isMine }"
        >
          <view class="message-bubble" :class="{ mine: item.isMine }">
            <text class="message-content">{{ item.content }}</text>
          </view>
          <text class="message-time">{{ formatTime(item.createdAt) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="composer">
      <input
        v-model="draft"
        class="composer-input"
        type="text"
        maxlength="500"
        placeholder="请输入回复内容"
        confirm-type="send"
        @confirm="handleSend"
      />
      <button
        class="send-btn"
        :disabled="sending"
        @click="handleSend"
      >
        {{ sending ? '发送中' : '发送' }}
      </button>
    </view>
  </view>
</template>

<script>
import { getTownErrandMessages, sendTownErrandMessage } from '@/api/town-errand-message.js'
import { getUserInfo as getStoredUserInfo } from '@/utils/storage.js'
import { formatTime } from '@/utils/index.js'

function pickList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function pickMessageId(item = {}, index = 0) {
  return item.id || item.message_id || item.messageId || `${index}-${item.created_at || Date.now()}`
}

function pickMessageContent(item = {}) {
  return item.content || item.message || item.text || ''
}

function pickMessageTime(item = {}) {
  return item.created_at || item.createdAt || item.sent_at || item.updated_at || ''
}

function pickSenderId(item = {}) {
  return item.sender_id || item.user_id || item.from_user_id || item.fromUserId || ''
}

function pickSenderRole(item = {}) {
  return String(item.sender_role || item.role || item.sender_type || item.user_role || '').toLowerCase()
}

export default {
  data() {
    return {
      conversationId: '',
      pageTitle: '会话详情',
      draft: '',
      loading: false,
      sending: false,
      messages: [],
      currentUserId: '',
      scrollAnchor: '',
      messagePollTimer: null
    }
  },
  onLoad(options) {
    this.conversationId = options.id || ''
    this.pageTitle = decodeURIComponent(options.title || '会话详情')
    const storedUser = getStoredUserInfo()
    this.currentUserId = storedUser?.id || ''
  },
  onShow() {
    this.initMessagePolling()
  },
  onHide() {
    this.stopMessagePolling()
  },
  onUnload() {
    this.stopMessagePolling()
  },
  methods: {
    formatTime,
    async initMessagePolling() {
      await this.loadMessages(true)
      this.startMessagePolling()
    },
    isMineMessage(item = {}) {
      const senderId = pickSenderId(item)
      const senderRole = pickSenderRole(item)
      if (this.currentUserId && String(senderId) === String(this.currentUserId)) {
        return true
      }
      return senderRole === 'stationmaster' || senderRole === 'rider'
    },
    async loadMessages(showLoading = true) {
      if (!this.conversationId) {
        uni.showToast({ title: '会话不存在', icon: 'none' })
        return
      }
      if (showLoading) {
        this.loading = true
      }
      try {
        const res = await getTownErrandMessages(this.conversationId)
        const source = pickList(res?.data ?? res)
        this.messages = source
          .map((item, index) => ({
            id: pickMessageId(item, index),
            content: pickMessageContent(item),
            createdAt: pickMessageTime(item),
            isMine: this.isMineMessage(item)
          }))
          .filter((item) => item.content)
        this.scrollToBottom()
      } catch (error) {
        console.error('加载镇上跑腿代购消息失败', error)
        this.messages = []
      } finally {
        this.loading = false
      }
    },
    startMessagePolling() {
      this.stopMessagePolling()
      this.messagePollTimer = setInterval(() => {
        this.loadMessages(false)
      }, 1500)
    },
    stopMessagePolling() {
      if (this.messagePollTimer) {
        clearInterval(this.messagePollTimer)
        this.messagePollTimer = null
      }
    },
    scrollToBottom() {
      if (!this.messages.length) {
        this.scrollAnchor = ''
        return
      }
      this.$nextTick(() => {
        this.scrollAnchor = `msg-${this.messages[this.messages.length - 1].id}`
      })
    },
    async handleSend() {
      const content = String(this.draft || '').trim()
      if (!content || this.sending) {
        if (!content) {
          uni.showToast({ title: '请输入回复内容', icon: 'none' })
        }
        return
      }
      try {
        this.sending = true
        await sendTownErrandMessage(this.conversationId, content)
        this.draft = ''
        await this.loadMessages(false)
      } catch (error) {
        console.error('发送镇上跑腿代购消息失败', error)
      } finally {
        this.sending = false
      }
    }
  }
}
</script>

<style scoped>
.page {
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.chat-header {
  background: #ffffff;
  margin: 24rpx 24rpx 0;
  border-radius: 20rpx;
  padding: 24rpx;
}

.chat-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
}

.chat-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999999;
}

.message-scroll {
  flex: 1;
  min-height: 0;
  padding: 24rpx 24rpx 160rpx;
  box-sizing: border-box;
}

.state-wrap {
  padding: 180rpx 0;
  text-align: center;
}

.state-text {
  font-size: 28rpx;
  color: #999999;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.message-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-row.mine {
  align-items: flex-end;
}

.message-bubble {
  max-width: 78%;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 20rpx;
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.04);
}

.message-bubble.mine {
  background: #1890ff;
}

.message-content {
  font-size: 28rpx;
  line-height: 1.6;
  color: #333333;
}

.message-bubble.mine .message-content {
  color: #ffffff;
}

.message-time {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #999999;
}

.composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #eeeeee;
  box-sizing: border-box;
}

.composer-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: #333333;
}

.send-btn {
  width: 140rpx;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  background: #1890ff;
  color: #ffffff;
  font-size: 28rpx;
  padding: 0;
}

.send-btn[disabled] {
  opacity: 0.7;
}
</style>
