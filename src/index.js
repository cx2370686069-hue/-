const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { DataTypes } = require('sequelize');
require('dotenv').config();

const { sequelize, ServiceArea } = require('../models');
const routes = require('../routes');
const errorHandler = require('../middleware/errorHandler');
const socketService = require('../services/socketService');
const SERVICE_AREAS = require('../config/serviceAreas');

const app = express();
// 支持从环境变量读取 PORT，为生产环境预留灵活性
const PORT = process.env.PORT || 3000;
const UPLOAD_IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const HASHED_UPLOAD_FILE_RE = /^\d{10,}-\d+\.[A-Za-z0-9]+$/;

const server = http.createServer(app);

// 为阿里云公网部署准备：支持多个来源或完全开放，支持前端通过任何域名/IP访问
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'token']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: UPLOAD_IMAGE_CACHE_MAX_AGE_SECONDS * 1000,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      const fileName = path.basename(filePath);
      const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
      if (!isImage) {
        return;
      }

      const immutable = HASHED_UPLOAD_FILE_RE.test(fileName) ? ', immutable' : '';
      res.setHeader(
        'Cache-Control',
        `public, max-age=${UPLOAD_IMAGE_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=86400${immutable}`
      );
    }
  })
);

// 统一响应拦截器中间件 (必须放在路由之前)
app.use((req, res, next) => {
  // 保存原始的 res.json 和 res.send
  const originalJson = res.json;
  
  res.json = function(data) {
    // 避免重复包装
    if (data && typeof data === 'object' && ('code' in data) && ('message' in data || 'msg' in data)) {
      // 统一 msg 到 message，保证前端拿到的都是 message
      if (data.msg && !data.message) {
        data.message = data.msg;
        delete data.msg;
      }
      return originalJson.call(this, data);
    }
    
    // 如果返回的不是标准格式，强制包装为标准格式
    return originalJson.call(this, {
      code: 0,
      message: 'success',
      data: data
    });
  };
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '跑腿后端 API',
    version: '1.0.0',
    description: '县城乡镇外卖跑腿 APP 后端服务',
    endpoints: {
      auth: '/api/auth',
      merchant: '/api/merchant',
      order: '/api/order',
      address: '/api/address',
      health: '/api/health'
    },
    socket: 'ws://localhost:' + PORT
  });
});

app.use((req, res, next) => {
  console.log(`[404 NOT FOUND] 请求方法: ${req.method}, 请求路径: ${req.originalUrl}`);
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
});

app.use(errorHandler);

const ensureColumns = async (tableName, columns) => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable(tableName);

  for (const column of columns) {
    if (table[column.name]) {
      continue;
    }
    await qi.addColumn(tableName, column.name, column.definition);
    console.log(`✅ 自动迁移：成功添加 ${tableName}.${column.name} 字段`);
  }
};

const ensureIndexes = async (tableName, indexes = []) => {
  const qi = sequelize.getQueryInterface();
  const existingIndexes = await qi.showIndex(tableName);
  const existingNames = new Set(
    (existingIndexes || [])
      .map((item) => item?.name)
      .filter(Boolean)
  );

  for (const index of indexes) {
    if (!index?.name || !Array.isArray(index.fields) || index.fields.length === 0) {
      continue;
    }
    if (existingNames.has(index.name)) {
      continue;
    }
    await qi.addIndex(tableName, {
      name: index.name,
      fields: index.fields
    });
    console.log(`✅ 自动迁移：成功添加索引 ${tableName}.${index.name}`);
  }
};

const ensureProductIndexes = async () => {
  await ensureIndexes('products', [
    {
      name: 'idx_products_merchant_status_sort',
      fields: ['merchant_id', 'status', 'sort']
    },
    {
      name: 'idx_products_merchant_category_status_sort',
      fields: ['merchant_id', 'category_id', 'status', 'sort']
    }
  ]);
};

const ensureOrderIndexes = async () => {
  await ensureIndexes('orders', [
    {
      name: 'idx_orders_user_visible_status',
      fields: ['user_id', 'buyer_deleted_at', 'status']
    }
  ]);
};

const ensureLegacyAddressColumnsCompatible = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('addresses');
  const legacyColumns = [
    {
      name: 'name',
      definition: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: '',
        comment: '旧版联系人兼容字段'
      }
    },
    {
      name: 'phone',
      definition: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '',
        comment: '旧版联系电话兼容字段'
      }
    },
    {
      name: 'address',
      definition: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '',
        comment: '旧版详细地址兼容字段'
      }
    }
  ];

  for (const column of legacyColumns) {
    if (!table[column.name]) {
      continue;
    }

    await qi.changeColumn('addresses', column.name, column.definition);
    console.log(`✅ 自动迁移：已放宽旧字段 addresses.${column.name} 约束`);
  }
};

const ensureOrderLogOperatorTypesCompatible = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('order_logs');
  if (!table.operator_type) {
    return;
  }

  await qi.changeColumn('order_logs', 'operator_type', {
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'system', 'dispatcher'),
    allowNull: true,
    comment: '操作人类型'
  });
  console.log('✅ 自动迁移：已补齐 order_logs.operator_type 的 dispatcher 枚举');
};

const ensureUserRoleEnumCompatible = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('users');
  if (!table.role) {
    return;
  }

  await qi.changeColumn('users', 'role', {
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'admin'),
    allowNull: false,
    defaultValue: 'user',
    comment: '角色：user-用户，merchant-商家，rider-骑手，admin-管理员'
  });
  console.log('✅ 自动迁移：已补齐 users.role 的 admin 枚举');
};

const ensureServiceAreasTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS service_areas (
      id INT NOT NULL AUTO_INCREMENT,
      area_code VARCHAR(32) NOT NULL,
      area_name VARCHAR(50) NOT NULL,
      area_type ENUM('county', 'town') NOT NULL,
      parent_code VARCHAR(32) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_area_code (area_code),
      KEY idx_area_type (area_type),
      KEY idx_parent_code (parent_code),
      KEY idx_is_enabled (is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：service_areas 表已就绪');
};

const ensureCartItemsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      merchant_id INT NULL,
      food_id INT NOT NULL,
      food_name VARCHAR(100) NOT NULL,
      price FLOAT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      selected_spec VARCHAR(100) NULL,
      created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cart_user_id (user_id),
      KEY idx_cart_merchant_id (merchant_id),
      KEY idx_cart_food_id (food_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：cart_items 表已就绪');
};

const ensureCountyOrderGroupsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS county_order_groups (
      id INT NOT NULL AUTO_INCREMENT,
      group_no VARCHAR(32) NOT NULL,
      user_id INT NOT NULL,
      main_order_id INT NULL,
      main_merchant_id INT NULL,
      store_count INT NOT NULL DEFAULT 0,
      status INT NOT NULL DEFAULT 0,
      goods_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      package_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      pay_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      customer_town VARCHAR(50) NULL,
      contact_phone VARCHAR(20) NULL,
      contact_name VARCHAR(50) NULL,
      delivery_address TEXT NULL,
      address VARCHAR(200) NOT NULL DEFAULT '',
      delivery_latitude DECIMAL(10, 8) NULL,
      delivery_longitude DECIMAL(11, 8) NULL,
      customer_lng DECIMAL(11, 8) NULL,
      customer_lat DECIMAL(10, 8) NULL,
      payment_channel VARCHAR(20) NULL,
      paid_at DATETIME NULL,
      remark TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_county_order_groups_group_no (group_no),
      KEY idx_county_order_groups_user_id (user_id),
      KEY idx_county_order_groups_status (status),
      KEY idx_county_order_groups_main_merchant_id (main_merchant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：county_order_groups 表已就绪');
};

const ensureTownErrandConversationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS town_errand_conversations (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      stationmaster_id INT NOT NULL,
      town_name VARCHAR(50) NOT NULL,
      status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
      last_message VARCHAR(500) NULL,
      last_message_sender_type ENUM('user', 'stationmaster') NULL,
      last_message_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_town_errand_conversation (user_id, stationmaster_id, town_name),
      KEY idx_town_errand_conversations_user_id (user_id),
      KEY idx_town_errand_conversations_stationmaster_id (stationmaster_id),
      KEY idx_town_errand_conversations_town_name (town_name),
      KEY idx_town_errand_conversations_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：town_errand_conversations 表已就绪');
};

const ensureTownErrandMessagesTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS town_errand_messages (
      id INT NOT NULL AUTO_INCREMENT,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      sender_type ENUM('user', 'stationmaster') NOT NULL,
      content TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_town_errand_messages_conversation_id (conversation_id),
      KEY idx_town_errand_messages_sender_id (sender_id),
      KEY idx_town_errand_messages_sender_type (sender_type),
      KEY idx_town_errand_messages_is_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：town_errand_messages 表已就绪');
};

const ensureUserPhoneChangeLogsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_phone_change_logs (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      old_phone VARCHAR(11) NOT NULL,
      new_phone VARCHAR(11) NOT NULL,
      change_year INT NOT NULL,
      verify_method ENUM('password') NOT NULL DEFAULT 'password',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_phone_change_logs_user_id (user_id),
      KEY idx_user_phone_change_logs_change_year (change_year),
      KEY idx_user_phone_change_logs_user_year (user_id, change_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：user_phone_change_logs 表已就绪');
};

const ensureSystemNotificationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS system_notifications (
      id INT NOT NULL AUTO_INCREMENT,
      title VARCHAR(100) NOT NULL,
      summary VARCHAR(255) NULL,
      content LONGTEXT NOT NULL,
      target_role ENUM('all', 'user', 'merchant', 'rider') NOT NULL DEFAULT 'all',
      status ENUM('draft', 'published', 'offline') NOT NULL DEFAULT 'draft',
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      created_by INT NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_system_notifications_status (status),
      KEY idx_system_notifications_target_role (target_role),
      KEY idx_system_notifications_is_pinned (is_pinned),
      KEY idx_system_notifications_published_at (published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：system_notifications 表已就绪');
};

const ensureSystemNotificationReadsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS system_notification_reads (
      id INT NOT NULL AUTO_INCREMENT,
      notification_id INT NOT NULL,
      user_id INT NOT NULL,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_system_notification_reads_notification_user (notification_id, user_id),
      KEY idx_system_notification_reads_user_id (user_id),
      KEY idx_system_notification_reads_notification_id (notification_id),
      KEY idx_system_notification_reads_read_at (read_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：system_notification_reads 表已就绪');
};

const ensureUserFeedbacksTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_feedbacks (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      content LONGTEXT NOT NULL,
      contact_phone VARCHAR(20) NOT NULL,
      status ENUM('pending', 'processing', 'resolved') NOT NULL DEFAULT 'pending',
      handled_by INT NULL,
      handled_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_feedbacks_user_id (user_id),
      KEY idx_user_feedbacks_status (status),
      KEY idx_user_feedbacks_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：user_feedbacks 表已就绪');
};

const ensurePaymentTransactionOrderNullable = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('payment_transactions');
  if (!table.order_id) {
    return;
  }

  await qi.changeColumn('payment_transactions', 'order_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '订单ID'
  });
  console.log('✅ 自动迁移：payment_transactions.order_id 已放宽为空');
};

const ensureServiceAreaSeeds = async () => {
  await ServiceArea.bulkCreate(
    SERVICE_AREAS.map((item) => ({
      ...item,
      is_enabled: true
    })),
    {
      updateOnDuplicate: ['area_name', 'area_type', 'parent_code', 'is_enabled', 'sort_order']
    }
  );
  console.log(`✅ 自动迁移：service_areas 基础字典已同步 ${SERVICE_AREAS.length} 条`);
};

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接验证完成');

    await ensureServiceAreasTable();
    await ensureServiceAreaSeeds();
    await ensureCartItemsTable();
    await ensureCountyOrderGroupsTable();
    await ensureTownErrandConversationsTable();
    await ensureTownErrandMessagesTable();
    await ensureUserPhoneChangeLogsTable();
    await ensureSystemNotificationsTable();
    await ensureSystemNotificationReadsTable();
    await ensureUserFeedbacksTable();

    // 自动数据库迁移：为 merchants 表添加 category 字段（如果不存在）
    try {
      await sequelize.query("ALTER TABLE merchants ADD COLUMN category VARCHAR(50) COMMENT '商家分类'");
      await sequelize.query("UPDATE merchants SET category = '美食'");
      console.log('✅ 自动迁移：成功添加 merchants.category 字段');
    } catch (err) {
      // 忽略已存在该字段的报错
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✅ 自动迁移：merchants.category 字段已存在');
      } else {
        console.log('⚠️ 自动迁移提示：', err.message);
      }
    }

    try {
      await ensureUserRoleEnumCompatible();

      await ensureColumns('users', [
        {
          name: 'rider_audit_status',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '骑手审核状态：0-待审核，1-已通过，2-已拒绝'
          }
        },
        {
          name: 'delivery_scope',
          definition: {
            type: DataTypes.ENUM('county_delivery', 'town_delivery'),
            allowNull: true,
            comment: '配送业务线'
          }
        },
        {
          name: 'rider_level',
          definition: {
            type: DataTypes.ENUM('captain', 'normal'),
            allowNull: true,
            comment: '骑手层级'
          }
        },
        {
          name: 'town_code',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '所属乡镇编码'
          }
        },
        {
          name: 'town_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '所属乡镇名称'
          }
        }
      ]);

      await ensureColumns('merchants', [
        {
          name: 'business_scope',
          definition: {
            type: DataTypes.ENUM('county_food', 'town_food'),
            allowNull: true,
            comment: '商家业务线'
          }
        },
        {
          name: 'town_code',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '所属乡镇编码'
          }
        },
        {
          name: 'town_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '所属乡镇名称'
          }
        },
        {
          name: 'business_license',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '营业执照图片URL'
          }
        },
        {
          name: 'supermarket_delivery_permission',
          definition: {
            type: DataTypes.ENUM('self_only', 'rider_only', 'hybrid'),
            allowNull: true,
            comment: '超市配送权限：self_only-只能老板自配，rider_only-只能骑手配送，hybrid-两者都支持'
          }
        },
        {
          name: 'channel_tags',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '频道标签，逗号分隔，如冷饮雪糕批发'
          }
        }
      ]);

      await ensureColumns('addresses', [
        {
          name: 'contact_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: '',
            comment: '联系人'
          }
        },
        {
          name: 'contact_phone',
          definition: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: '',
            comment: '联系电话'
          }
        },
        {
          name: 'province',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '省'
          }
        },
        {
          name: 'city',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '市'
          }
        },
        {
          name: 'district',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '区/县'
          }
        },
        {
          name: 'street',
          definition: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: '街道/乡镇'
          }
        },
        {
          name: 'detail',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: '',
            comment: '详细地址'
          }
        },
        {
          name: 'latitude',
          definition: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
            comment: '纬度'
          }
        },
        {
          name: 'longitude',
          definition: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
            comment: '经度'
          }
        },
        {
          name: 'is_default',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            comment: '是否默认地址'
          }
        },
        {
          name: 'created_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '创建时间'
          }
        },
        {
          name: 'updated_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '更新时间'
          }
        },
        {
          name: 'buyer_deleted_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '用户侧移出列表时间，仅影响买家订单列表展示'
          }
        }
      ]);

      await ensureLegacyAddressColumnsCompatible();

      await ensureColumns('cart_items', [
        {
          name: 'merchant_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '商家ID'
          }
        },
        {
          name: 'selected_spec',
          definition: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: '已选规格文本'
          }
        },
        {
          name: 'created_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '创建时间'
          }
        },
        {
          name: 'updated_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '更新时间'
          }
        }
      ]);

      await ensureColumns('orders', [
        {
          name: 'contact_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '联系人'
          }
        },
        {
          name: 'order_id',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '业务订单ID'
          }
        },
        {
          name: 'items_json',
          definition: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            comment: '商品JSON'
          }
        },
        {
          name: 'total_price',
          definition: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0.00,
            comment: '订单总价'
          }
        },
        {
          name: 'address',
          definition: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: '',
            comment: '地址'
          }
        },
        {
          name: 'merchant_lng',
          definition: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
            comment: '商家经度'
          }
        },
        {
          name: 'merchant_lat',
          definition: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
            comment: '商家纬度'
          }
        },
        {
          name: 'customer_lng',
          definition: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
            comment: '客户经度'
          }
        },
        {
          name: 'customer_lat',
          definition: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
            comment: '客户纬度'
          }
        },
        {
          name: 'merge_group_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '县城美食拼单组ID'
          }
        },
        {
          name: 'is_group_main',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: '是否为拼单主店订单'
          }
        },
        {
          name: 'supermarket_delivery_permission_snapshot',
          definition: {
            type: DataTypes.ENUM('self_only', 'rider_only', 'hybrid'),
            allowNull: true,
            comment: '超市下单时的店铺配送权限快照'
          }
        },
        {
          name: 'supermarket_delivery_mode',
          definition: {
            type: DataTypes.ENUM('pending', 'self_delivery', 'rider_delivery'),
            allowNull: true,
            comment: '超市订单实际配送模式'
          }
        },
        {
          name: 'settlement_rule_snapshot',
          definition: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: '订单分账规则快照'
          }
        },
        {
          name: 'created_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '创建时间'
          }
        },
        {
          name: 'updated_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '更新时间'
          }
        }
      ]);

      await ensureColumns('payment_transactions', [
        {
          name: 'group_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '县城美食拼单组ID'
          }
        },
        {
          name: 'biz_type',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'order',
            comment: '支付业务类型'
          }
        }
      ]);
      await ensurePaymentTransactionOrderNullable();
      await ensureProductIndexes();
      await ensureOrderIndexes();

      await ensureOrderLogOperatorTypesCompatible();
    } catch (err) {
      console.log('⚠️ 自动迁移提示：', err.message);
    }

    socketService.init(server);

    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   🚀 跑腿后端服务已启动                        ║
║                                               ║
║   访问地址：http://localhost:${PORT}            ║
║   API 地址：http://localhost:${PORT}/api         ║
║   WebSocket：ws://localhost:${PORT}             ║
║                                               ║
║   按 Ctrl+C 停止服务                           ║
║                                               ║
╚═══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
