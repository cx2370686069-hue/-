// 这个文件是“模型总入口”。
// 它做两件事：
// 1. 统一导出所有 Sequelize 模型
// 2. 在这里集中注册模型之间的关联关系
const User = require('./User');
const Merchant = require('./Merchant');
const MerchantPushDevice = require('./MerchantPushDevice');
const MerchantWithdrawRecord = require('./MerchantWithdrawRecord');
const Product = require('./Product');
const ProductCategory = require('./ProductCategory');
const CartItem = require('./CartItem');
const Order = require('./Order');
const CountyOrderGroup = require('./CountyOrderGroup');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const PaymentTransaction = require('./PaymentTransaction');
const WalletLog = require('./WalletLog');
const ProductSpec = require('./ProductSpec');
const ProductDigitalProfile = require('./ProductDigitalProfile');
const Refund = require('./Refund');
const Review = require('./Review');
const ServiceArea = require('./ServiceArea');
const OrderTransfer = require('./OrderTransfer');
const TownErrandConversation = require('./TownErrandConversation');
const TownErrandMessage = require('./TownErrandMessage');
const UserPhoneChangeLog = require('./UserPhoneChangeLog');
const { UserFeedback } = require('./UserFeedback');
const { SystemNotification } = require('./SystemNotification');
const SystemNotificationRead = require('./SystemNotificationRead');

// ==================== 模型关联关系注册区 ====================

// 用户 - 商家（一对一）
User.hasOne(Merchant, { foreignKey: 'user_id', as: 'merchant' });
Merchant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商家 - 商家自配送员工（一对多）
Merchant.hasMany(User, { foreignKey: 'bound_merchant_id', as: 'deliveryAgents' });
User.belongsTo(Merchant, { foreignKey: 'bound_merchant_id', as: 'boundMerchant' });

// 商家 - 商品分类（一对多）
Merchant.hasMany(ProductCategory, { foreignKey: 'merchant_id', as: 'categories' });
ProductCategory.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 商家 - 商品（一对多）
Merchant.hasMany(Product, { foreignKey: 'merchant_id', as: 'products' });
Product.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 商品分类 - 商品（一对多）
ProductCategory.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(ProductCategory, { foreignKey: 'category_id', as: 'category' });

// 用户 - 地址（一对多）
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 手机号变更日志（一对多）
User.hasMany(UserPhoneChangeLog, { foreignKey: 'user_id', as: 'phoneChangeLogs' });
UserPhoneChangeLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 投诉建议（一对多）
User.hasMany(UserFeedback, { foreignKey: 'user_id', as: 'feedbacks' });
UserFeedback.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 系统通知已读记录（一对多）
User.hasMany(SystemNotificationRead, { foreignKey: 'user_id', as: 'notificationReads' });
SystemNotificationRead.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 购物车（一对多）
User.hasMany(CartItem, { foreignKey: 'user_id', as: 'cartItems' });
CartItem.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商品 - 购物车（一对多）
Product.hasMany(CartItem, { foreignKey: 'food_id', as: 'cartItems' });
CartItem.belongsTo(Product, { foreignKey: 'food_id', as: 'product' });

// 用户 - 订单（一对多）
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 镇上跑腿代购会话（一对多）
User.hasMany(TownErrandConversation, { foreignKey: 'user_id', as: 'townErrandConversations' });
TownErrandConversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 站长（User） - 镇上跑腿代购会话（一对多）
User.hasMany(TownErrandConversation, { foreignKey: 'stationmaster_id', as: 'stationmasterConversations' });
TownErrandConversation.belongsTo(User, { foreignKey: 'stationmaster_id', as: 'stationmaster' });

// 用户 - 镇上跑腿代购消息（一对多）
User.hasMany(TownErrandMessage, { foreignKey: 'sender_id', as: 'townErrandSentMessages' });
TownErrandMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// 用户 - 县城美食拼单组（一对多）
User.hasMany(CountyOrderGroup, { foreignKey: 'user_id', as: 'countyOrderGroups' });
CountyOrderGroup.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商家 - 订单（一对多）
Merchant.hasMany(Order, { foreignKey: 'merchant_id', as: 'orders' });
Order.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 商家 - 提现申请记录（一对多）
Merchant.hasMany(MerchantWithdrawRecord, { foreignKey: 'merchant_id', as: 'withdrawRecords' });
MerchantWithdrawRecord.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 商家 - 推送设备（一对多）
Merchant.hasMany(MerchantPushDevice, { foreignKey: 'merchant_id', as: 'pushDevices' });
MerchantPushDevice.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 用户 - 商家推送设备（一对多）
User.hasMany(MerchantPushDevice, { foreignKey: 'user_id', as: 'merchantPushDevices' });
MerchantPushDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 县城美食拼单组 - 商家（主店）
Merchant.hasMany(CountyOrderGroup, { foreignKey: 'main_merchant_id', as: 'mainCountyOrderGroups' });
CountyOrderGroup.belongsTo(Merchant, { foreignKey: 'main_merchant_id', as: 'mainMerchant' });

// 骑手（User） - 订单（一对多）
User.hasMany(Order, { foreignKey: 'rider_id', as: 'riderOrders' });
Order.belongsTo(User, { foreignKey: 'rider_id', as: 'rider' });

// 县城美食拼单组 - 子订单（一对多）
CountyOrderGroup.hasMany(Order, { foreignKey: 'merge_group_id', as: 'childOrders' });
Order.belongsTo(CountyOrderGroup, { foreignKey: 'merge_group_id', as: 'mergeGroup' });

// 订单 - 订单日志（一对多）
Order.hasMany(OrderLog, { foreignKey: 'order_id', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 订单 - 转派记录（一对多）
Order.hasMany(OrderTransfer, { foreignKey: 'order_id', as: 'transfers' });
OrderTransfer.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 用户 - 发起/接收/撤回转派记录
User.hasMany(OrderTransfer, { foreignKey: 'from_user_id', as: 'outgoingOrderTransfers' });
OrderTransfer.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });
User.hasMany(OrderTransfer, { foreignKey: 'to_user_id', as: 'incomingOrderTransfers' });
OrderTransfer.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });
User.hasMany(OrderTransfer, { foreignKey: 'revoked_by_user_id', as: 'revokedOrderTransfers' });
OrderTransfer.belongsTo(User, { foreignKey: 'revoked_by_user_id', as: 'revokedByUser' });

// 订单 - 支付交易（一对多）
Order.hasMany(PaymentTransaction, { foreignKey: 'order_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 县城美食拼单组 - 支付交易（一对多）
CountyOrderGroup.hasMany(PaymentTransaction, { foreignKey: 'group_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(CountyOrderGroup, { foreignKey: 'group_id', as: 'countyOrderGroup' });

// 资金流水 - 用户（多对一）
User.hasMany(WalletLog, { foreignKey: 'user_id', as: 'walletLogs' });
WalletLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商品 - 商品规格（一对多）
Product.hasMany(ProductSpec, { foreignKey: 'product_id', as: 'specs' });
ProductSpec.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 商品 - 手机数码扩展信息（一对一）
Product.hasOne(ProductDigitalProfile, { foreignKey: 'product_id', as: 'digital_profile' });
ProductDigitalProfile.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 订单 - 退款工单（一对一/一对多视业务而定，通常一单支持多次部分退款所以一对多）
Order.hasMany(Refund, { foreignKey: 'order_id', as: 'refunds' });
Refund.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 镇上跑腿代购会话 - 消息（一对多）
TownErrandConversation.hasMany(TownErrandMessage, { foreignKey: 'conversation_id', as: 'messages' });
TownErrandMessage.belongsTo(TownErrandConversation, { foreignKey: 'conversation_id', as: 'conversation' });

// 系统通知 - 已读记录（一对多）
SystemNotification.hasMany(SystemNotificationRead, { foreignKey: 'notification_id', as: 'reads' });
SystemNotificationRead.belongsTo(SystemNotification, { foreignKey: 'notification_id', as: 'notification' });

// 用户/商家 - 退款（多对一）
User.hasMany(Refund, { foreignKey: 'user_id', as: 'refunds' });
Refund.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Merchant.hasMany(Refund, { foreignKey: 'merchant_id', as: 'refunds' });
Refund.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 订单 - 评价（一对一）
Order.hasOne(Review, { foreignKey: 'order_id', as: 'review' });
Review.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 商家/骑手/用户 - 评价（一对多）
Merchant.hasMany(Review, { foreignKey: 'merchant_id', as: 'reviews' });
Review.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });
User.hasMany(Review, { foreignKey: 'rider_id', as: 'riderReviews' });
Review.belongsTo(User, { foreignKey: 'rider_id', as: 'rider' });
User.hasMany(Review, { foreignKey: 'user_id', as: 'userReviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize: require('../config/database'),
  User,
  Merchant,
  MerchantPushDevice,
  MerchantWithdrawRecord,
  Product,
  ProductCategory,
  CartItem,
  Order,
  CountyOrderGroup,
  OrderLog,
  Address,
  PaymentTransaction,
  WalletLog,
  ProductSpec,
  ProductDigitalProfile,
  Refund,
  Review,
  ServiceArea,
  OrderTransfer,
  SystemNotification,
  SystemNotificationRead,
  UserFeedback,
  UserPhoneChangeLog,
  TownErrandConversation,
  TownErrandMessage
};
