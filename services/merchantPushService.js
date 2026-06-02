// 这个文件是“商家远程推送服务”。
// 主要负责把商家端设备 client_id 绑定的设备，通过个推 / UniPush 发送远程通知。
const crypto = require('crypto');
const https = require('https');
const { MerchantPushDevice } = require('../models');

const GETUI_BASE_URL = String(process.env.GETUI_BASE_URL || 'https://restapi.getui.com/v2').replace(/\/+$/, '');
const GETUI_APP_ID = String(process.env.GETUI_APP_ID || process.env.UNIPUSH_APP_ID || '').trim();
const GETUI_APP_KEY = String(process.env.GETUI_APP_KEY || process.env.UNIPUSH_APP_KEY || '').trim();
const GETUI_MASTER_SECRET = String(process.env.GETUI_MASTER_SECRET || process.env.UNIPUSH_MASTER_SECRET || '').trim();
const DEFAULT_PUSH_TTL_MS = Number(process.env.MERCHANT_PUSH_TTL_MS || 60 * 60 * 1000);
const NEW_ORDER_PUSH_TTL_MS = Number(process.env.MERCHANT_NEW_ORDER_PUSH_TTL_MS || 60 * 1000);

let cachedToken = '';
let cachedTokenExpireAt = 0;

// 先判断个推配置是否齐全。
function hasGetuiConfig() {
  return !!(GETUI_APP_ID && GETUI_APP_KEY && GETUI_MASTER_SECRET);
}

// 生成请求 id / 去重 key 时统一走这里。
function createRequestId(prefix = 'merchant') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function safeTrim(value) {
  return String(value || '').trim();
}

// 这里专门判断“这条设备绑定还能不能作为商家推送目标”。
// 现在同一个账号允许同时登录用户端 / 商家端 / 骑手端，
// 所以后端不能只看 client_id，还得保证这条记录本身带着有效 app_id。
// 否则旧脏数据、错误端上报、历史遗留绑定，都可能把商家推送误打到别的端上。
function hasValidPushBinding(device = {}) {
  const appId = safeTrim(device && device.app_id);
  const bindingVersion = Number(device && device.binding_version || 0);
  // 这里只认“新版商家端重新注册过”的设备。
  // 历史旧记录即使还留在表里，也先不允许继续吃商家推送，避免把语音串到错误设备。
  return !!appId && bindingVersion >= 2;
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

// 这里是最底层的 HTTPS JSON 请求封装。
function requestJson(method, requestUrl, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestUrl);
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        const parsed = safeJsonParse(raw) || { raw };
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        const message = parsed?.msg || parsed?.message || `HTTP_${res.statusCode}`;
        reject(new Error(message));
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// 个推 token 有缓存，避免每推一次都重新鉴权。
async function getGetuiToken() {
  if (!hasGetuiConfig()) {
    return '';
  }
  if (cachedToken && cachedTokenExpireAt - Date.now() > 60 * 1000) {
    return cachedToken;
  }
  const timestamp = String(Date.now());
  const response = await requestJson('POST', `${GETUI_BASE_URL}/${GETUI_APP_ID}/auth`, {}, {
    sign: sha256(`${GETUI_APP_KEY}${timestamp}${GETUI_MASTER_SECRET}`),
    timestamp,
    appkey: GETUI_APP_KEY
  });
  const token = safeTrim(response?.data?.token);
  const expireTime = Number(response?.data?.expire_time || 0);
  if (!token) {
    throw new Error('getui_token_empty');
  }
  cachedToken = token;
  cachedTokenExpireAt = Number.isFinite(expireTime) ? expireTime : (Date.now() + 23 * 60 * 60 * 1000);
  return cachedToken;
}

// 把前端跳转路径和参数拼成最终 url。
function buildRouteUrl(jumpPath = '', jumpParams = null) {
  const path = safeTrim(jumpPath);
  if (!path) return '/pages/order/list';
  if (!jumpParams || typeof jumpParams !== 'object' || Array.isArray(jumpParams)) {
    return path;
  }
  const search = new URLSearchParams();
  Object.keys(jumpParams).forEach((key) => {
    const value = jumpParams[key];
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  if (!query) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

// 把业务消息整理成远程推送统一 payload。
function buildRemotePayload(payload = {}) {
  return {
    source: 'merchant_remote_push',
    type: payload.type || '',
    eventType: payload.eventType || payload.type || '',
    title: payload.title || '商家提醒',
    message: payload.message || '',
    speechText: payload.speechText || '',
    soundType: payload.soundType || '',
    priority: payload.priority || 'normal',
    jumpPath: payload.jumpPath || '/pages/order/list',
    jumpParams: payload.jumpParams || {},
    url: buildRouteUrl(payload.jumpPath, payload.jumpParams),
    dedupeKey: payload.dedupeKey || createRequestId('dedupe'),
    data: payload.data || null,
    timestamp: payload.timestamp || new Date().toISOString()
  };
}

function isMerchantNewOrderPayload(payload = {}) {
  const eventType = safeTrim(payload.eventType || payload.type).toLowerCase();
  return ['new_order', 'merchant_new_order'].includes(eventType);
}

// 新订单是强实时消息，过了这一小段窗口再送达，商家端很容易把旧消息当成当前新单。
// 所以新订单推送单独给一个更短的 TTL，避免骑手接单后旧推送才姗姗来迟。
function resolvePushTtlMs(payload = {}) {
  const ttl = isMerchantNewOrderPayload(payload) ? NEW_ORDER_PUSH_TTL_MS : DEFAULT_PUSH_TTL_MS;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return 60 * 1000;
  }
  return ttl;
}

// 这里生成真正发给个推的请求体。
function buildGetuiBody(clientId, payload = {}) {
  const remotePayload = buildRemotePayload(payload);
  return {
    request_id: createRequestId('merchant_push'),
    settings: {
      ttl: resolvePushTtlMs(payload)
    },
    audience: {
      cid: [clientId]
    },
    push_message: {
      notification: {
        title: remotePayload.title,
        body: remotePayload.message || remotePayload.speechText || remotePayload.title,
        click_type: 'payload',
        payload: JSON.stringify(remotePayload)
      }
    }
  };
}

// 按单个 client_id 发一条远程通知。
async function pushByClientId(clientId, payload = {}) {
  if (!hasGetuiConfig()) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing_getui_config'
    };
  }
  const token = await getGetuiToken();
  const response = await requestJson(
    'POST',
    `${GETUI_BASE_URL}/${GETUI_APP_ID}/push/single/cid`,
    { token },
    buildGetuiBody(clientId, payload)
  );
  return {
    sent: true,
    skipped: false,
    result: response
  };
}

// 记录设备最近一次推送结果，方便后面排查推送失败。
async function markDevicePushResult(deviceId, result = {}) {
  if (!deviceId) return;
  const updates = {
    last_push_at: new Date(),
    last_push_result: result?.status || (result?.sent ? 'sent' : (result?.skipped ? 'skipped' : 'failed')),
    last_error: result?.error || null
  };
  await MerchantPushDevice.update(updates, { where: { id: deviceId } });
}

// 查当前商家账号下所有启用中的推送设备。
async function getMerchantDevicesByUserId(merchantUserId) {
  const devices = await MerchantPushDevice.findAll({
    where: {
      user_id: merchantUserId,
      push_enabled: true,
      notification_enabled: true
    },
    order: [['last_seen_at', 'DESC']]
  });
  return devices.filter((device) => hasValidPushBinding(device));
}

// 给某个商家账号下的所有设备群发远程通知。
// 这里会逐台设备推送，并把成功 / 失败结果写回数据库。
async function notifyMerchantRemotePush(merchantUserId, payload = {}) {
  if (!merchantUserId) {
    return [];
  }
  const devices = await getMerchantDevicesByUserId(merchantUserId);
  if (!devices.length) {
    return [];
  }

  const results = [];
  for (const device of devices) {
    const clientId = safeTrim(device.client_id);
    if (!clientId) {
      continue;
    }
    try {
      const pushResult = await pushByClientId(clientId, payload);
      const status = pushResult.skipped ? pushResult.reason : 'sent';
      await markDevicePushResult(device.id, { ...pushResult, status, error: null });
      results.push({
        clientId,
        ...pushResult
      });
    } catch (error) {
      await markDevicePushResult(device.id, {
        sent: false,
        skipped: false,
        status: 'failed',
        error: error.message || 'push_failed'
      });
      results.push({
        clientId,
        sent: false,
        skipped: false,
        error: error.message || 'push_failed'
      });
    }
  }
  return results;
}

module.exports = {
  hasGetuiConfig,
  notifyMerchantRemotePush
};
