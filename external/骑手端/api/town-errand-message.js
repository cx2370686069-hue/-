/**
 * 镇上跑腿代购消息 API
 */
import { get, post } from '@/utils/request.js'

export function getTownErrandConversations(params = {}) {
  return get('/town-errand/conversations', params)
}

export function getTownErrandMessages(conversationId, params = {}) {
  return get(`/town-errand/conversations/${conversationId}/messages`, params)
}

export function sendTownErrandMessage(conversationId, content) {
  return post(`/town-errand/conversations/${conversationId}/messages`, { content })
}
