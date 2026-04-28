-- 跑腿外卖数据库初始化脚本
-- 数据库名：gushi_waimai
-- 字符集：utf8mb4

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `gushi_waimai` 
DEFAULT CHARACTER SET utf8mb4 
DEFAULT COLLATE utf8mb4_unicode_ci;

USE `gushi_waimai`;

-- 说明：
-- 数据库表会在项目首次启动时自动创建（通过 Sequelize 的 sync 功能）
-- 如果需要手动创建，可以运行以下 SQL：

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(11) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `nickname` VARCHAR(50),
  `avatar` VARCHAR(255),
  `role` ENUM('user', 'merchant', 'rider', 'admin') NOT NULL DEFAULT 'user',
  `status` INT DEFAULT 1,
  `rider_status` INT DEFAULT 0,
  `rider_balance` DECIMAL(10,2) DEFAULT 0.00,
  `rider_kind` ENUM('rider', 'stationmaster') NOT NULL DEFAULT 'rider',
  `rider_town` VARCHAR(50),
  `rider_latitude` DECIMAL(10,8),
  `rider_longitude` DECIMAL(11,8),
  `rider_location_updated_at` DATETIME,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 商家表
CREATE TABLE IF NOT EXISTS `merchants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `logo` VARCHAR(255),
  `cover` VARCHAR(255),
  `phone` VARCHAR(20),
  `business_license` VARCHAR(255),
  `address` VARCHAR(255),
  `business_scope` ENUM('county_food', 'town_food') DEFAULT NULL,
  `town_code` VARCHAR(32) DEFAULT NULL,
  `town_name` VARCHAR(50) DEFAULT NULL,
  `latitude` DECIMAL(10,8),
  `longitude` DECIMAL(11,8),
  `delivery_radius` FLOAT DEFAULT 5.0,
  `min_price` DECIMAL(10,2) DEFAULT 0.00,
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00,
  `status` INT DEFAULT 1,
  `audit_status` INT DEFAULT 0,
  `balance` DECIMAL(10,2) DEFAULT 0.00,
  `withdrawn_amount` DECIMAL(10,2) DEFAULT 0.00,
  `total_income` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家表';

-- 商品分类表
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `merchant_id` INT NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `sort` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- 商品表
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `merchant_id` INT NOT NULL,
  `category_id` INT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `images` TEXT,
  `price` DECIMAL(10,2) NOT NULL,
  `original_price` DECIMAL(10,2),
  `stock` INT DEFAULT 999,
  `sales` INT DEFAULT 0,
  `status` INT DEFAULT 1,
  `sort` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- 订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL,
  `user_id` INT NOT NULL,
  `merchant_id` INT NOT NULL,
  `rider_id` INT,
  `type` ENUM('takeout', 'errand') NOT NULL DEFAULT 'takeout',
  `order_type` ENUM('county', 'town') NOT NULL DEFAULT 'county',
  `customer_town` VARCHAR(50),
  `dispatch_center_status` VARCHAR(20),
  `dispatch_center_order_id` VARCHAR(64),
  `dispatch_sent_at` DATETIME,
  `status` INT DEFAULT 0,
  `products_info` TEXT,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `delivery_fee` DECIMAL(10,2) DEFAULT 0.00,
  `package_fee` DECIMAL(10,2) DEFAULT 0.00,
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
  `pay_amount` DECIMAL(10,2) NOT NULL,
  `rider_fee` DECIMAL(10,2) DEFAULT 0.00,
  `delivery_type` INT DEFAULT 1,
  `contact_phone` VARCHAR(20),
  `contact_name` VARCHAR(50),
  `delivery_address` TEXT,
  `delivery_latitude` DECIMAL(10,8),
  `delivery_longitude` DECIMAL(11,8),
  `errand_type` VARCHAR(50),
  `errand_description` TEXT,
  `paid_at` DATETIME,
  `accepted_at` DATETIME,
  `delivered_at` DATETIME,
  `remark` TEXT,
  `cancel_reason` VARCHAR(255),
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_rider_id` (`rider_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 订单日志表
CREATE TABLE IF NOT EXISTS `order_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `operator_id` INT,
  `operator_type` ENUM('user', 'merchant', 'rider', 'system', 'dispatcher'),
  `action` VARCHAR(50) NOT NULL,
  `from_status` INT,
  `to_status` INT,
  `remark` VARCHAR(255),
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单日志表';

-- 地址表
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `contact_name` VARCHAR(50) NOT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `province` VARCHAR(50),
  `city` VARCHAR(50),
  `district` VARCHAR(50),
  `street` VARCHAR(100),
  `detail` VARCHAR(255) NOT NULL,
  `latitude` DECIMAL(10,8),
  `longitude` DECIMAL(11,8),
  `is_default` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地址表';
