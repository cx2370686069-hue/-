-- ============================================
-- 数据库: gushi_waimai
-- 说明: 固始县外卖系统基础表结构
-- ============================================

-- 1. 用户表 (users)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(11) NOT NULL COMMENT '手机号',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
  `nickname` VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像 URL',
  `role` ENUM('user','merchant','rider','admin') NOT NULL DEFAULT 'user' COMMENT '角色：user-用户，merchant-商家，rider-骑手，admin-管理员',
  `status` INT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
  `rider_status` INT DEFAULT 0 COMMENT '骑手状态：0-休息，1-接单中',
  `rider_balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT '骑手余额',
  `rider_kind` ENUM('rider','stationmaster') DEFAULT 'rider' COMMENT '骑手类型',
  `rider_town` VARCHAR(50) DEFAULT NULL COMMENT '所属乡镇',
  `rider_latitude` DECIMAL(10,8) DEFAULT NULL COMMENT '骑手当前位置纬度',
  `rider_longitude` DECIMAL(11,8) DEFAULT NULL COMMENT '骑手当前位置经度',
  `rider_location_updated_at` DATETIME DEFAULT NULL COMMENT '骑手位置更新时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 2. 商家表 (merchants)
CREATE TABLE IF NOT EXISTS `merchants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '关联用户 ID',
  `name` VARCHAR(100) NOT NULL COMMENT '店铺名称',
  `description` TEXT COMMENT '店铺描述',
  `logo` VARCHAR(255) DEFAULT NULL COMMENT '店铺 Logo URL',
  `cover` VARCHAR(255) DEFAULT NULL COMMENT '店铺封面 URL',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `business_license` VARCHAR(255) DEFAULT NULL COMMENT '营业执照图片URL',
  `address` VARCHAR(255) DEFAULT NULL COMMENT '店铺地址',
  `business_scope` ENUM('county_food','town_food') DEFAULT NULL COMMENT '商家业务线',
  `town_code` VARCHAR(32) DEFAULT NULL COMMENT '所属乡镇编码',
  `town_name` VARCHAR(50) DEFAULT NULL COMMENT '所属乡镇名称',
  `latitude` DECIMAL(10,8) DEFAULT NULL COMMENT '纬度',
  `longitude` DECIMAL(11,8) DEFAULT NULL COMMENT '经度',
  `delivery_radius` FLOAT DEFAULT 5.0 COMMENT '配送半径（公里）',
  `min_price` DECIMAL(10,2) DEFAULT 0.00 COMMENT '起送价',
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '配送费',
  `status` INT DEFAULT 1 COMMENT '营业状态：0-休息，1-营业',
  `audit_status` INT DEFAULT 0 COMMENT '审核状态：0-待审核，1-已通过，2-已拒绝',
  `balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT '可提现余额',
  `withdrawn_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计已提现金额',
  `total_income` DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计收入',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家表';

-- 3. 商品分类表 (product_categories)
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `merchant_id` INT NOT NULL COMMENT '所属商家 ID',
  `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `sort` INT DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- 4. 商品表 (products)
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `merchant_id` INT NOT NULL COMMENT '所属商家 ID',
  `category_id` INT DEFAULT NULL COMMENT '分类 ID',
  `name` VARCHAR(100) NOT NULL COMMENT '商品名称',
  `description` TEXT COMMENT '商品描述',
  `images` TEXT COMMENT '商品图片（JSON 数组）',
  `price` DECIMAL(10,2) NOT NULL COMMENT '商品价格',
  `original_price` DECIMAL(10,2) DEFAULT NULL COMMENT '原价',
  `stock` INT DEFAULT 999 COMMENT '库存',
  `sales` INT DEFAULT 0 COMMENT '销量',
  `status` INT DEFAULT 1 COMMENT '状态：0-下架，1-上架',
  `sort` INT DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- 5. 订单表 (orders)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL COMMENT '订单号',
  `user_id` INT NOT NULL COMMENT '下单用户 ID',
  `merchant_id` INT NOT NULL COMMENT '商家 ID',
  `rider_id` INT DEFAULT NULL COMMENT '骑手 ID',
  `type` ENUM('takeout','errand') NOT NULL DEFAULT 'takeout' COMMENT '订单类型：takeout-外卖，errand-跑腿',
  `order_type` ENUM('county','town') DEFAULT 'county' COMMENT '外卖业务类型',
  `customer_town` VARCHAR(50) DEFAULT NULL COMMENT '客户所在乡镇',
  `dispatch_center_status` VARCHAR(20) DEFAULT NULL COMMENT '调度中心状态',
  `dispatch_center_order_id` VARCHAR(64) DEFAULT NULL COMMENT '调度中心订单ID',
  `dispatch_sent_at` DATETIME DEFAULT NULL COMMENT '推送调度中心时间',
  `status` INT DEFAULT 0 COMMENT '订单状态：0-待支付，1-待接单，2-已接单，3-备货中，4-备货完成，5-配送中，6-已完成，7-已取消',
  `products_info` TEXT COMMENT '商品信息（JSON）',
  `total_amount` DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '配送费',
  `package_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '打包费',
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '优惠金额',
  `pay_amount` DECIMAL(10,2) NOT NULL COMMENT '实付金额',
  `rider_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '骑手费用',
  `delivery_type` INT DEFAULT 1 COMMENT '配送方式：1-配送，2-自取',
  `contact_phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `contact_name` VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  `delivery_address` TEXT COMMENT '配送地址（JSON）',
  `delivery_latitude` DECIMAL(10,8) DEFAULT NULL COMMENT '配送地址纬度',
  `delivery_longitude` DECIMAL(11,8) DEFAULT NULL COMMENT '配送地址经度',
  `errand_type` VARCHAR(50) DEFAULT NULL COMMENT '跑腿类型',
  `errand_description` TEXT COMMENT '跑腿需求描述',
  `paid_at` DATETIME DEFAULT NULL COMMENT '支付时间',
  `payment_channel` VARCHAR(20) DEFAULT NULL COMMENT '支付渠道',
  `commission_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '平台抽成金额',
  `rider_incentive_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '骑手激励金额',
  `platform_income_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '平台收入',
  `merchant_income_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '商家收入',
  `settled_at` DATETIME DEFAULT NULL COMMENT '结算入账时间',
  `accepted_at` DATETIME DEFAULT NULL COMMENT '接单时间',
  `delivered_at` DATETIME DEFAULT NULL COMMENT '送达时间',
  `remark` TEXT COMMENT '用户备注',
  `cancel_reason` VARCHAR(255) DEFAULT NULL COMMENT '取消原因',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_rider_id` (`rider_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- ============================================
-- 插入测试数据
-- ============================================

-- 1. 插入测试用户
INSERT INTO `users` (`id`, `phone`, `password`, `nickname`, `role`, `status`, `created_at`, `updated_at`) VALUES
(1, '13800138000', '$2a$10$YourHashedPasswordHere', '测试骑手', 'rider', 1, NOW(), NOW()),
(2, '13900139000', '$2a$10$YourHashedPasswordHere', '测试商家', 'merchant', 1, NOW(), NOW()),
(3, '13700137000', '$2a$10$YourHashedPasswordHere', '测试买家', 'user', 1, NOW(), NOW());

-- 2. 插入测试商家
INSERT INTO `merchants` (`id`, `user_id`, `name`, `description`, `phone`, `address`, `latitude`, `longitude`, `status`, `audit_status`, `created_at`, `updated_at`) VALUES
(1, 2, '蜜雪冰城', '好喝不贵，蜜雪冰城！', '13900139000', '固始县中山大街123号', 32.16821000, 115.66352000, 1, 1, NOW(), NOW()),
(2, 2, '深夜烧烤', '正宗烧烤，夜宵首选', '13900139001', '固始县红苏路456号', 32.15566000, 115.67055000, 1, 1, NOW(), NOW());

-- 3. 插入商品分类
INSERT INTO `product_categories` (`id`, `merchant_id`, `name`, `sort`, `created_at`, `updated_at`) VALUES
(1, 1, '奶茶', 1, NOW(), NOW()),
(2, 1, '果茶', 2, NOW(), NOW()),
(3, 2, '烤串', 1, NOW(), NOW()),
(4, 2, '酒水', 2, NOW(), NOW());

-- 4. 插入测试商品 - 奶茶类
INSERT INTO `products` (`id`, `merchant_id`, `category_id`, `name`, `description`, `images`, `price`, `original_price`, `stock`, `sales`, `status`, `sort`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '珍珠奶茶', '经典口味，Q弹珍珠', '["https://example.com/milktea1.jpg"]', 8.00, 10.00, 100, 50, 1, 1, NOW(), NOW()),
(2, 1, 1, '芋泥波波奶茶', '香甜芋泥，口感丰富', '["https://example.com/milktea2.jpg"]', 12.00, 15.00, 80, 30, 1, 2, NOW(), NOW()),
(3, 1, 2, '满杯百香果', '酸甜可口，清爽解腻', '["https://example.com/fruittea1.jpg"]', 10.00, 12.00, 60, 40, 1, 3, NOW(), NOW());

-- 5. 插入测试商品 - 烧烤类
INSERT INTO `products` (`id`, `merchant_id`, `category_id`, `name`, `description`, `images`, `price`, `original_price`, `stock`, `sales`, `status`, `sort`, `created_at`, `updated_at`) VALUES
(4, 2, 3, '羊肉串', '新鲜羊肉，炭火烤制', '["https://example.com/bbq1.jpg"]', 5.00, 6.00, 200, 100, 1, 1, NOW(), NOW()),
(5, 2, 3, '烤鸡翅', '外焦里嫩，香辣可口', '["https://example.com/bbq2.jpg"]', 8.00, 10.00, 150, 80, 1, 2, NOW(), NOW()),
(6, 2, 3, '烤韭菜', '绿色健康，蒜香四溢', '["https://example.com/bbq3.jpg"]', 3.00, 4.00, 100, 60, 1, 3, NOW(), NOW()),
(7, 2, 4, '雪花啤酒', '冰爽啤酒，烧烤绝配', '["https://example.com/beer.jpg"]', 6.00, 8.00, 300, 200, 1, 4, NOW(), NOW());

-- 6. 插入测试订单 - 待支付状态
INSERT INTO `orders` (`id`, `order_no`, `user_id`, `merchant_id`, `rider_id`, `type`, `order_type`, `status`, `products_info`, `total_amount`, `delivery_fee`, `package_fee`, `pay_amount`, `rider_fee`, `delivery_type`, `contact_phone`, `contact_name`, `delivery_address`, `delivery_latitude`, `delivery_longitude`, `remark`, `created_at`, `updated_at`) VALUES
(1, 'ORD202403230001', 3, 1, NULL, 'takeout', 'county', 0, '[{"product_id":1,"name":"珍珠奶茶","quantity":2,"price":8.00},{"product_id":2,"name":"芋泥波波奶茶","quantity":1,"price":12.00}]', 28.00, 3.00, 1.00, 32.00, 3.00, 1, '13700137000', '张三', '{"province":"河南省","city":"信阳市","district":"固始县","street":"番城街道","detail":"幸福小区3号楼201室"}', 32.18683000, 115.65158000, '少糖，多加珍珠', NOW(), NOW());

-- 7. 插入测试订单 - 配送中状态（已有骑手接单）
INSERT INTO `orders` (`id`, `order_no`, `user_id`, `merchant_id`, `rider_id`, `type`, `order_type`, `status`, `products_info`, `total_amount`, `delivery_fee`, `package_fee`, `pay_amount`, `rider_fee`, `delivery_type`, `contact_phone`, `contact_name`, `delivery_address`, `delivery_latitude`, `delivery_longitude`, `paid_at`, `accepted_at`, `remark`, `created_at`, `updated_at`) VALUES
(2, 'ORD202403230002', 3, 2, 1, 'takeout', 'county', 5, '[{"product_id":4,"name":"羊肉串","quantity":10,"price":5.00},{"product_id":5,"name":"烤鸡翅","quantity":2,"price":8.00},{"product_id":7,"name":"雪花啤酒","quantity":2,"price":6.00}]', 70.00, 5.00, 2.00, 77.00, 5.00, 1, '13700137000', '张三', '{"province":"河南省","city":"信阳市","district":"固始县","street":"秀水街道","detail":"秀水公园南门对面小区5单元"}', 32.15566000, 115.67055000, NOW(), NOW(), '多放辣，快点送', NOW(), NOW());
