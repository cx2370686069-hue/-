/**
 * 商家端新订单提醒：
 * 1. 优先尝试音频文件路径 `/static/audio/new-order.mp3`
 * 2. 若文件不存在或浏览器限制自动播放，则回退为 Web Audio 生成提示音
 * 3. H5 需用户首次点击一次“开启提示音”完成解锁
 */

const STORAGE_KEY = 'merchantNotifyEnabled'
const AUDIO_PATH = '/static/audio/new-order.mp3'

let _audio = null
let _webAudioContext = null
let _enabled = false
let _unlocked = false
let _lastError = ''
let _mode = 'idle'

function beepByAppDevice() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.device && typeof plus.device.beep === 'function') {
      plus.device.beep(1)
      _mode = 'app-beep'
      _lastError = ''
      emitNotifyStatus()
      logNotify('app-beep-success', { count: 1 })
      return true
    }
  } catch (e) {
    _lastError = (e && (e.message || e.errMsg)) || 'app-beep-failed'
    logNotify('app-beep-failed', _lastError)
    emitNotifyStatus()
  }
  // #endif
  return false
}

function speakByAppTTS(text) {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.speech && typeof plus.speech.speak === 'function') {
      plus.speech.speak(String(text || '您有新的订单，请及时处理'), {
        engine: 'baidu',
        volume: 1,
        pitch: 1,
        rate: 1
      })
      _mode = 'app-tts'
      _lastError = ''
      emitNotifyStatus()
      logNotify('app-tts-success', { text })
      return true
    }
  } catch (e) {
    _lastError = (e && (e.message || e.errMsg)) || 'app-tts-failed'
    logNotify('app-tts-failed', _lastError)
    emitNotifyStatus()
  }
  // #endif
  return false
}

function isH5Runtime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function logNotify(step, payload) {
  try {
    console.log('[merchant-notify][' + step + ']', payload || '')
  } catch (e) {}
}

function emitNotifyStatus() {
  try {
    uni.$emit('merchant_notify_status_changed', getMerchantNotifyStatus())
  } catch (e) {}
}

function persistEnabled(enabled) {
  _enabled = !!enabled
  try {
    uni.setStorageSync(STORAGE_KEY, _enabled ? 1 : 0)
  } catch (e) {}
  emitNotifyStatus()
}

function initEnabledState() {
  if (_enabled || _unlocked) return
  try {
    const saved = uni.getStorageSync(STORAGE_KEY)
    if (saved === 1 || saved === '1' || saved === true) {
      _enabled = true
      _unlocked = !isH5Runtime()
    } else if (!isH5Runtime()) {
      _enabled = true
      _unlocked = true
    }
  } catch (e) {
    if (!isH5Runtime()) {
      _enabled = true
      _unlocked = true
    }
  }
}

function ensureInnerAudio() {
  if (typeof uni.createInnerAudioContext !== 'function') return null
  if (_audio) return _audio
  _audio = uni.createInnerAudioContext()
  _audio.autoplay = false
  _audio.loop = false
  _audio.obeyMuteSwitch = false
  _audio.src = AUDIO_PATH
  _audio.onCanplay(() => {
    _mode = 'audio-file'
    logNotify('audio-canplay', { src: AUDIO_PATH })
    emitNotifyStatus()
  })
  _audio.onPlay(() => {
    _mode = 'audio-file'
    _lastError = ''
    logNotify('audio-play-success', { src: AUDIO_PATH })
    emitNotifyStatus()
  })
  _audio.onError((err) => {
    _lastError = (err && (err.errMsg || err.message)) || 'audio-error'
    logNotify('audio-play-error', err)
    emitNotifyStatus()
  })
  return _audio
}

function ensureWebAudioContext() {
  if (!isH5Runtime()) return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!_webAudioContext) {
    _webAudioContext = new AudioCtx()
  }
  return _webAudioContext
}

async function unlockWebAudio() {
  const ctx = ensureWebAudioContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    osc.type = 'sine'
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    osc.start(now)
    osc.stop(now + 0.02)
    _mode = 'web-audio'
    _lastError = ''
    return true
  } catch (e) {
    _lastError = (e && e.message) || 'web-audio-unlock-failed'
    logNotify('unlock-web-audio-failed', _lastError)
    return false
  }
}

function playWebAudioBeep() {
  const ctx = ensureWebAudioContext()
  if (!ctx) return false
  if (ctx.state !== 'running') {
    _lastError = 'web-audio-not-running'
    return false
  }
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.setValueAtTime(988, now + 0.18)
  osc.connect(gain)
  osc.start(now)
  osc.stop(now + 0.46)

  const osc2 = ctx.createOscillator()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(660, now + 0.12)
  osc2.frequency.setValueAtTime(784, now + 0.34)
  osc2.connect(gain)
  osc2.start(now + 0.12)
  osc2.stop(now + 0.48)

  _mode = 'web-audio'
  _lastError = ''
  return true
}

export function getMerchantNotifyStatus() {
  initEnabledState()
  return {
    enabled: !!_enabled,
    unlocked: !!_unlocked,
    mode: _mode,
    lastError: _lastError
  }
}

export async function enableMerchantNotifyByUserGesture() {
  initEnabledState()
  logNotify('enable-start', getMerchantNotifyStatus())
  let unlocked = false

  const audio = ensureInnerAudio()
  if (audio && typeof audio.play === 'function') {
    try {
      audio.stop()
      audio.play()
      audio.pause()
      audio.seek && audio.seek(0)
      unlocked = true
      _mode = 'audio-file'
      _lastError = ''
      logNotify('enable-inner-audio-success', { src: AUDIO_PATH })
    } catch (e) {
      _lastError = (e && e.message) || 'inner-audio-unlock-failed'
      logNotify('enable-inner-audio-failed', _lastError)
    }
  }

  if (!unlocked) {
    unlocked = await unlockWebAudio()
  }

  _unlocked = unlocked || _unlocked || !isH5Runtime()
  if (_unlocked) {
    persistEnabled(true)
  } else {
    emitNotifyStatus()
  }
  logNotify('enable-end', getMerchantNotifyStatus())
  return getMerchantNotifyStatus()
}

export async function ensureMerchantNotifyReady() {
  initEnabledState()
  if (!_enabled) {
    emitNotifyStatus()
    return getMerchantNotifyStatus()
  }
  if (_unlocked) {
    emitNotifyStatus()
    return getMerchantNotifyStatus()
  }

  const audio = ensureInnerAudio()
  if (audio && typeof audio.play === 'function') {
    try {
      audio.stop()
      audio.play()
      audio.pause()
      audio.seek && audio.seek(0)
      _unlocked = true
      _mode = 'audio-file'
      _lastError = ''
      emitNotifyStatus()
      logNotify('ensure-inner-audio-success', getMerchantNotifyStatus())
      return getMerchantNotifyStatus()
    } catch (e) {
      _lastError = (e && e.message) || 'ensure-inner-audio-failed'
      logNotify('ensure-inner-audio-failed', _lastError)
    }
  }

  if (!isH5Runtime()) {
    _unlocked = true
    _lastError = ''
    emitNotifyStatus()
    logNotify('ensure-non-h5-ready', getMerchantNotifyStatus())
    return getMerchantNotifyStatus()
  }

  emitNotifyStatus()
  logNotify('ensure-h5-wait-user-gesture', getMerchantNotifyStatus())
  return getMerchantNotifyStatus()
}

export function playMerchantNewOrderNotify() {
  initEnabledState()
  logNotify('play-start', getMerchantNotifyStatus())

  try {
    uni.vibrateLong()
  } catch (e) {
    try {
      uni.vibrateShort()
    } catch (e2) {}
  }

  if (!_enabled) {
    _lastError = 'notify-disabled'
    logNotify('play-skipped', { reason: _lastError })
    emitNotifyStatus()
    return false
  }

  if (beepByAppDevice()) {
    return true
  }

  if (speakByAppTTS('您有新的订单，请及时处理')) {
    return true
  }

  const audio = ensureInnerAudio()
  if (audio) {
    try {
      audio.stop()
      audio.seek && audio.seek(0)
      audio.play()
      logNotify('play-inner-audio-called', { src: AUDIO_PATH })
      return true
    } catch (e) {
      _lastError = (e && e.message) || 'inner-audio-play-failed'
      logNotify('play-inner-audio-failed', _lastError)
    }
  }

  const webAudioPlayed = playWebAudioBeep()
  if (webAudioPlayed) {
    logNotify('play-web-audio-success', getMerchantNotifyStatus())
    emitNotifyStatus()
    return true
  }

  logNotify('play-failed', getMerchantNotifyStatus())
  emitNotifyStatus()
  return false
}
