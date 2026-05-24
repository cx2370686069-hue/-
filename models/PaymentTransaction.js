// 这个文件只是“支付流水模型代理入口”。
// 真正的 PaymentTransaction(支付流水模型) 已经拆到 modules(模块)/payment(支付模块)/PaymentTransaction.js(支付流水模型)。
module.exports = require('../modules/payment/PaymentTransaction');

