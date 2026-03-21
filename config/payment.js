const path = require('path');

/**
 * 支付与分账全局配置
 *
 * 说明：
 * - 当前方案采用「公司统一商户号 + 分账接收方」模式：
 *   - 平台公司只申请一个微信商户号、一个支付宝商户账号；
 *   - 商家、骑手在本系统中以“分账接收方”的形式存在，不需要各自去办理商户号；
 * - 所有真实的商户号、密钥、证书路径等敏感信息，都通过环境变量或服务器本地文件管理，
 *   不会出现在前端代码或公开仓库中。
 */

const PAYMENT_CONFIG = {
  /**
   * 商户模式
   * unified_merchant_with_profit_sharing：统一商户 + 分账接收方（推荐，当前采用）
   */
  merchantMode: 'unified_merchant_with_profit_sharing',

  /**
   * 全局业务抽成与配送规则
   */
  businessRules: {
    // 平台对商品金额的抽成比例（例如 0.2 表示 20%）
    commissionRate: 0.2,
    // 抽成中分给骑手的比例（其余为平台所得，例如 0.5 表示对半分）
    riderShareOfCommission: 0.5,
    // 配送计费规则：3 公里内 2.5 元，超出部分按公里加价
    deliveryPricing: {
      baseDistanceKm: 3,
      baseFee: 2.5,
      extraPerKm: 1
    },
    // 结算延迟时间（小时），用于实现“确认收货后约 3 小时内到账”的业务预期
    settlementDelayHours: Number(process.env.SETTLEMENT_DELAY_HOURS || 3)
  },

  /**
   * 微信支付配置（服务端使用）
   *
   * 注意：以下字段全部来自环境变量，便于在不同环境（测试 / 生产）下配置不同参数。
   * 真实值由运维在服务器上配置，代码仓库中不应出现具体商户号或密钥。
   */
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    mchId: process.env.WECHAT_MCH_ID || '',
    apiKey: process.env.WECHAT_API_KEY || '',
    // v3 密钥（若使用 V3 接口）
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    // 商户证书相关（使用绝对路径或相对项目根目录的路径）
    certPath: process.env.WECHAT_CERT_PATH
      ? path.resolve(process.env.WECHAT_CERT_PATH)
      : '',
    keyPath: process.env.WECHAT_KEY_PATH
      ? path.resolve(process.env.WECHAT_KEY_PATH)
      : '',
    // 支付结果回调地址（外网可访问的 HTTPS 地址，由运维在环境变量中配置）
    notifyUrl:
      process.env.WECHAT_NOTIFY_URL ||
      'https://your-domain.com/api/pay/wechat/notify',
    refundNotifyUrl:
      process.env.WECHAT_REFUND_NOTIFY_URL ||
      'https://your-domain.com/api/pay/wechat/refund-notify'
  },

  /**
   * 支付宝支付配置（服务端使用）
   */
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    // 支付宝网关
    gateway:
      process.env.ALIPAY_GATEWAY ||
      'https://openapi.alipay.com/gateway.do',
    // 应用私钥与支付宝公钥（仅在服务端使用）
    appPrivateKeyPath: process.env.ALIPAY_APP_PRIVATE_KEY_PATH
      ? path.resolve(process.env.ALIPAY_APP_PRIVATE_KEY_PATH)
      : '',
    alipayPublicKeyPath: process.env.ALIPAY_PUBLIC_KEY_PATH
      ? path.resolve(process.env.ALIPAY_PUBLIC_KEY_PATH)
      : '',
    // 支付结果与退款回调地址
    notifyUrl:
      process.env.ALIPAY_NOTIFY_URL ||
      'https://your-domain.com/api/pay/alipay/notify',
    refundNotifyUrl:
      process.env.ALIPAY_REFUND_NOTIFY_URL ||
      'https://your-domain.com/api/pay/alipay/refund-notify'
  }
};

module.exports = PAYMENT_CONFIG;

