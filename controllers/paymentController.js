// 这个文件只是“支付控制器代理入口”。
// 真正的支付逻辑已经拆到 modules(模块)/payment(支付模块)/controller.js(支付控制器) 里，
// 这里保留一层导出，主要是兼容旧的 require 路径，避免别的文件改动过大。
module.exports = require('../modules/payment/controller');

