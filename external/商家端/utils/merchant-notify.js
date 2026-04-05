/**
 * 商家端新订单提醒：震动 + 提示音（请将 mp3 置于 static/audio/new-order.mp3）
 */

let _audio = null

export function playMerchantNewOrderNotify() {
  try {
    uni.vibrateLong()
  } catch (e) {
    try {
      uni.vibrateShort()
    } catch (e2) {}
  }

  try {
    if (typeof uni.createInnerAudioContext !== 'function') {
      return
    }
    if (!_audio) {
      _audio = uni.createInnerAudioContext()
      _audio.obeyMuteSwitch = false
      _audio.onError(() => {})
    }
    _audio.stop()
    _audio.src = '/static/audio/new-order.mp3'
    _audio.play()
  } catch (e) {
    // 无音频文件或环境不支持时仅震动
  }
}
