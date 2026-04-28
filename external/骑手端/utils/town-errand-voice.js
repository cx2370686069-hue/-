const NOTICE_TEXT = '您有跑腿消息，请及时回复'
const NOTICE_COOLDOWN_MS = 3000
const LOG_PREFIX = '[town-errand-voice]'

let lastSpeakAt = 0
let plusReadyListening = false
let plusReadyCallbacks = []
let androidTtsInstance = null
let androidTtsReady = false
let androidTtsInitializing = false
let androidTtsCallbacks = []

function logInfo(message, extra) {
  if (typeof extra === 'undefined') {
    console.log(LOG_PREFIX, message)
    return
  }
  console.log(LOG_PREFIX, message, extra)
}

function logWarn(message, extra) {
  if (typeof extra === 'undefined') {
    console.warn(LOG_PREFIX, message)
    return
  }
  console.warn(LOG_PREFIX, message, extra)
}

function logError(message, extra) {
  if (typeof extra === 'undefined') {
    console.error(LOG_PREFIX, message)
    return
  }
  console.error(LOG_PREFIX, message, extra)
}

function isAppPlusRuntime() {
  // #ifdef APP-PLUS
  return true
  // #endif
  return false
}

function showVisualNotice() {
  uni.showToast({
    title: NOTICE_TEXT,
    icon: 'none',
    duration: 2000
  })

  if (typeof uni.vibrateShort === 'function') {
    uni.vibrateShort()
  }
}

function fallbackToBeep(reason) {
  logWarn('语音播报失败，降级为 beep', reason)
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.device && typeof plus.device.beep === 'function') {
    plus.device.beep(1)
    return true
  }
  // #endif
  return false
}

function flushPlusReadyCallbacks() {
  const callbacks = plusReadyCallbacks.slice()
  plusReadyCallbacks = []
  callbacks.forEach((callback) => {
    try {
      callback()
    } catch (error) {
      logError('执行 plusready 队列回调失败', error)
    }
  })
}

function ensurePlusReady(callback) {
  if (!isAppPlusRuntime()) {
    logWarn('当前不是 APP-PLUS 环境，跳过真机语音播报')
    return false
  }

  if (typeof plus !== 'undefined') {
    logInfo('plus 已就绪，可直接执行语音播报', {
      plusExists: true,
      windowPlusExists: typeof window !== 'undefined' && !!window.plus,
      plusSpeechExists: !!plus.speech,
      plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === 'function')
    })
    callback()
    return true
  }

  plusReadyCallbacks.push(callback)
  logWarn('plus 尚未就绪，等待 plusready 后再播报', {
    queueLength: plusReadyCallbacks.length
  })

  if (!plusReadyListening && typeof document !== 'undefined' && document.addEventListener) {
    plusReadyListening = true
    const onPlusReady = () => {
      document.removeEventListener('plusready', onPlusReady, false)
      plusReadyListening = false
      logInfo('收到 plusready 事件，开始执行等待中的语音播报')
      flushPlusReadyCallbacks()
    }
    document.addEventListener('plusready', onPlusReady, false)
  }

  return false
}

function flushAndroidTtsCallbacks(success, payload) {
  const callbacks = androidTtsCallbacks.slice()
  androidTtsCallbacks = []
  callbacks.forEach((callback) => {
    try {
      callback(success, payload)
    } catch (error) {
      logError('执行 Android TTS 队列回调失败', error)
    }
  })
}

function ensureAndroidTtsReady(callback) {
  if (androidTtsReady && androidTtsInstance) {
    callback(true)
    return
  }

  androidTtsCallbacks.push(callback)
  if (androidTtsInitializing) {
    logInfo('Android TTS 正在初始化，加入等待队列', {
      queueLength: androidTtsCallbacks.length
    })
    return
  }

  androidTtsInitializing = true

  try {
    // #ifdef APP-PLUS
    if (!plus.os || plus.os.name !== 'Android') {
      const reason = { message: '当前 APP 平台不是 Android，未接入原生 TextToSpeech' }
      logWarn('Android TTS 不可用', reason)
      androidTtsInitializing = false
      flushAndroidTtsCallbacks(false, reason)
      return
    }

    const mainActivity = plus.android.runtimeMainActivity()
    const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
    const Locale = plus.android.importClass('java.util.Locale')

    logInfo('开始初始化 Android TextToSpeech', {
      plusSpeechExists: !!plus.speech,
      plusSpeechSpeakExists: !!(plus.speech && typeof plus.speech.speak === 'function')
    })

    const initListener = plus.android.implements('android.speech.tts.TextToSpeech$OnInitListener', {
      onInit: function(status) {
        try {
          const successCode = Number(TextToSpeech.SUCCESS)
          const initSuccess = Number(status) === successCode || Number(status) === 0
          logInfo('Android TextToSpeech onInit 回调', {
            status: Number(status),
            successCode
          })

          if (!initSuccess) {
            androidTtsReady = false
            androidTtsInitializing = false
            flushAndroidTtsCallbacks(false, {
              message: 'Android TextToSpeech 初始化失败',
              status: Number(status)
            })
            return
          }

          androidTtsReady = true
          androidTtsInitializing = false

          try {
            const localeResult = androidTtsInstance.setLanguage(Locale.CHINA)
            logInfo('Android TextToSpeech 语言设置完成', {
              localeResult: Number(localeResult)
            })
          } catch (localeError) {
            logError('Android TextToSpeech 设置语言失败', localeError)
          }

          flushAndroidTtsCallbacks(true)
        } catch (callbackError) {
          androidTtsReady = false
          androidTtsInitializing = false
          logError('Android TextToSpeech onInit 处理失败', callbackError)
          flushAndroidTtsCallbacks(false, callbackError)
        }
      }
    })

    androidTtsInstance = new TextToSpeech(mainActivity, initListener)
    logInfo('已发起 Android TextToSpeech 初始化请求')
    // #endif
  } catch (error) {
    androidTtsReady = false
    androidTtsInitializing = false
    logError('初始化 Android TextToSpeech 异常', error)
    flushAndroidTtsCallbacks(false, error)
  }
}

function speakWithAndroidTts() {
  try {
    // #ifdef APP-PLUS
    const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
    const result = androidTtsInstance.speak(NOTICE_TEXT, TextToSpeech.QUEUE_FLUSH, null, 'town_errand_notice')
    const errorCode = Number(TextToSpeech.ERROR)

    logInfo('已调用 Android TextToSpeech.speak', {
      result: Number(result),
      errorCode
    })

    if (Number(result) === errorCode) {
      throw new Error(`Android TextToSpeech.speak 返回错误码 ${result}`)
    }

    return true
    // #endif
  } catch (error) {
    logError('Android TextToSpeech.speak 执行失败', error)
    return false
  }

  return false
}

export function speakTownErrandIncomingMessage() {
  const now = Date.now()
  const interval = now - lastSpeakAt

  logInfo('收到镇上跑腿代购语音播报请求', {
    now,
    lastSpeakAt,
    interval
  })

  if (lastSpeakAt > 0 && interval < NOTICE_COOLDOWN_MS) {
    logWarn('命中 3 秒防重复播报，已跳过', {
      interval,
      cooldown: NOTICE_COOLDOWN_MS
    })
    return false
  }

  lastSpeakAt = now
  showVisualNotice()

  if (!isAppPlusRuntime()) {
    logWarn('当前为非 APP 环境，仅保留文字提示，不执行真机语音')
    return false
  }

  ensurePlusReady(() => {
    ensureAndroidTtsReady((success, payload) => {
      if (!success) {
        logError('Android TTS 未就绪，无法执行语音播报', payload)
        fallbackToBeep(payload)
        return
      }

      const speakSuccess = speakWithAndroidTts()
      if (!speakSuccess) {
        fallbackToBeep({ message: 'Android TTS speak 调用失败' })
      }
    })
  })

  return true
}
