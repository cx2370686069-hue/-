// 这个文件只是“支付路由代理入口”。
// 真正的支付路由已经拆到 modules(模块)/payment(支付模块)/routes.js(支付路由) 里，
// 这里保留导出，主要是兼容旧的 require 路径。
module.exports = require('../modules/payment/routes');

