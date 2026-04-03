// 导出所有模型
const User = require('./User');
const Merchant = require('./Merchant');
const Product = require('./Product');
const ProductCategory = require('./ProductCategory');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const PaymentTransaction = require('./PaymentTransaction');
const WalletLog = require('./WalletLog');
const ProductSpec = require('./ProductSpec');
const Refund = require('./Refund');
const Review = require('./Review');

// 定义模型关系

// 用户 - 商家（一对一）
User.hasOne(Merchant, { foreignKey: 'user_id', as: 'merchant' });
Merchant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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

// 用户 - 订单（一对多）
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商家 - 订单（一对多）
Merchant.hasMany(Order, { foreignKey: 'merchant_id', as: 'orders' });
Order.belongsTo(Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

// 骑手（User） - 订单（一对多）
User.hasMany(Order, { foreignKey: 'rider_id', as: 'riderOrders' });
Order.belongsTo(User, { foreignKey: 'rider_id', as: 'rider' });

// 订单 - 订单日志（一对多）
Order.hasMany(OrderLog, { foreignKey: 'order_id', as: 'logs' });
OrderLog.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 订单 - 支付交易（一对多）
Order.hasMany(PaymentTransaction, { foreignKey: 'order_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 资金流水 - 用户（多对一）
User.hasMany(WalletLog, { foreignKey: 'user_id', as: 'walletLogs' });
WalletLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商品 - 商品规格（一对多）
Product.hasMany(ProductSpec, { foreignKey: 'product_id', as: 'specs' });
ProductSpec.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 订单 - 退款工单（一对一/一对多视业务而定，通常一单支持多次部分退款所以一对多）
Order.hasMany(Refund, { foreignKey: 'order_id', as: 'refunds' });
Refund.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

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
  Product,
  ProductCategory,
  Order,
  OrderLog,
  Address,
  PaymentTransaction,
  WalletLog,
  ProductSpec,
  Refund,
  Review
};
