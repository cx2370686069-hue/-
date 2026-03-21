// 导出所有模型
const User = require('./User');
const Merchant = require('./Merchant');
const Product = require('./Product');
const ProductCategory = require('./ProductCategory');
const Order = require('./Order');
const OrderLog = require('./OrderLog');
const Address = require('./Address');
const PaymentTransaction = require('./PaymentTransaction');

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

module.exports = {
  sequelize: require('../config/database'),
  User,
  Merchant,
  Product,
  ProductCategory,
  Order,
  OrderLog,
  Address,
  PaymentTransaction
};
