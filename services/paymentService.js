// 这个文件只是“支付服务代理入口”。
// 真正的支付业务已经拆到 modules(模块)/payment(支付模块)/service.js(支付服务) 里，
// 这里保留导出，主要是兼容旧的引用路径。
module.exports = require('../modules/payment/service');
