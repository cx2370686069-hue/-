// 这个文件只是“支付配置代理入口”。
// 真实配置已经拆到 modules(模块目录)/payment(支付模块)/config.js(支付配置) 里，
// 这里保留旧入口，主要是兼容历史 require 路径。
module.exports = require('../modules/payment/config');

