const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { DataTypes, QueryTypes, Op } = require('sequelize');
require('dotenv').config();

const { sequelize, ServiceArea, Merchant } = require('../models');
const routes = require('../routes');
const errorHandler = require('../middleware/errorHandler');
const socketService = require('../services/socketService');
const SERVICE_AREAS = require('../config/serviceAreas');
const { parseStoredImageList } = require('../utils/imageAssets');
const { ensureVariantsForLocalUploadUrl } = require('../utils/imageProcessor');
const { generateUniqueMerchantBindingCode } = require('../utils/merchantBinding');

// 这个文件就是“后端总启动入口”。
// 它不只是把 Express 服务跑起来，还顺手负责：
// 1. 挂静态资源和 API 路由
// 2. 初始化 Socket 实时服务
// 3. 启动时自动补表、补字段、补索引、补基础字典
// 所以以后只要数据库结构和启动过程有问题，第一时间先看这里。
const app = express();
// 支持从环境变量读取 PORT，为生产环境预留灵活性
const PORT = process.env.PORT || 3000;
const UPLOAD_IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const HASHED_UPLOAD_FILE_RE = /^\d{10,}-\d+\.[A-Za-z0-9]+$/;
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').trim();

const server = http.createServer(app);

if (TRUST_PROXY) {
  app.set('trust proxy', TRUST_PROXY === 'true' ? true : TRUST_PROXY);
}

// ==================== 基础中间件区 ====================
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

server.on('upgrade', (req) => {
  if (!req?.url || !req.url.startsWith('/socket.io')) {
    return;
  }
  console.log('[socket:upgrade:request]', {
    url: req.url,
    host: req.headers?.host || '',
    origin: req.headers?.origin || '',
    forwardedProto: req.headers?.['x-forwarded-proto'] || '',
    forwardedFor: req.headers?.['x-forwarded-for'] || '',
    userAgent: req.headers?.['user-agent'] || ''
  });
});

// ==================== 静态资源挂载区 ====================
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

app.use(
  '/user-map-picker',
  express.static(path.join(__dirname, '../static/user-map-picker'))
);

app.use(
  '/merchant-map-picker',
  express.static(path.join(__dirname, '../static/merchant-map-picker'))
);

// ==================== 统一响应包装区 ====================
// 这里会把零散的 res.json 返回值统一包成 { code, message, data } 结构。
// 必须放在路由前面，不然很多控制器返回不会被拦到。
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

// ==================== 路由与兜底错误区 ====================
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

// ==================== 自动迁移工具区 ====================
// 下面这批 ensure* 工具，都是启动时用来“补结构”的。
// 也正因为它们存在，所以这个项目的数据库标准结构不能只看历史 SQL，还得看这里。
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
      fields: index.fields,
      unique: Boolean(index.unique)
    });
    console.log(`✅ 自动迁移：成功添加索引 ${tableName}.${index.name}`);
  }
};

// 旧版 users(用户表) 对 phone(手机号) 做过唯一索引。
// 现在审核驳回后允许释放手机号重新申请，所以这里要主动把旧唯一索引拆掉。
const dropLegacyUniquePhoneIndexes = async () => {
  const qi = sequelize.getQueryInterface();
  const existingIndexes = await qi.showIndex('users');
  const uniquePhoneIndexes = (existingIndexes || []).filter((index) => {
    if (!index?.name || !index?.unique || index.primary) {
      return false;
    }
    const fields = Array.isArray(index.fields) ? index.fields : [];
    if (fields.length !== 1) {
      return false;
    }
    const fieldName = String(fields[0]?.attribute || fields[0]?.name || '').trim();
    return fieldName === 'phone';
  });

  for (const index of uniquePhoneIndexes) {
    await qi.removeIndex('users', index.name);
    console.log(`✅ 自动迁移：已移除 users.${index.name} 唯一手机号索引`);
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
    },
    {
      name: 'idx_orders_transfer_lookup',
      fields: ['is_transfer_order', 'current_responsible_user_id', 'status']
    }
  ]);
};

// 下面这些 ensureXxxTable，主要是给“代码里已经开始用了，但老库里还没有”的表做兜底补齐。
const ensureOrderTransfersTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS order_transfers (
      id INT NOT NULL AUTO_INCREMENT,
      order_id INT NOT NULL,
      transfer_round INT NOT NULL DEFAULT 1,
      from_user_id INT NOT NULL,
      from_role VARCHAR(32) NOT NULL DEFAULT 'rider',
      from_scope VARCHAR(32) NULL,
      from_town_name VARCHAR(50) NULL,
      to_user_id INT NOT NULL,
      to_role VARCHAR(32) NOT NULL DEFAULT 'rider',
      to_scope VARCHAR(32) NULL,
      to_town_name VARCHAR(50) NULL,
      status_before_transfer INT NOT NULL DEFAULT 0,
      remark VARCHAR(255) NULL,
      is_revoked TINYINT(1) NOT NULL DEFAULT 0,
      revoked_at DATETIME NULL,
      revoked_by_user_id INT NULL,
      revoke_remark VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_order_transfers_order_id (order_id),
      KEY idx_order_transfers_to_user_id (to_user_id),
      KEY idx_order_transfers_from_user_id (from_user_id),
      KEY idx_order_transfers_is_revoked (is_revoked),
      KEY idx_order_transfers_transfer_round (transfer_round)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单转派记录';
  `);
};

const ensureMerchantWithdrawRecordsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS merchant_withdraw_records (
      id INT NOT NULL AUTO_INCREMENT,
      withdraw_no VARCHAR(32) NOT NULL,
      merchant_id INT NOT NULL,
      user_id INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status ENUM('pending', 'paid', 'rejected') NOT NULL DEFAULT 'pending',
      bank_name VARCHAR(100) NULL,
      bank_card VARCHAR(64) NULL,
      balance_before DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      balance_after DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      applied_at DATETIME NOT NULL,
      processed_at DATETIME NULL,
      remark VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_merchant_withdraw_records_withdraw_no (withdraw_no),
      KEY idx_merchant_withdraw_records_merchant_id (merchant_id),
      KEY idx_merchant_withdraw_records_user_id (user_id),
      KEY idx_merchant_withdraw_records_status (status),
      KEY idx_merchant_withdraw_records_applied_at (applied_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家提现申请记录';
  `);
  console.log('✅ 自动迁移：merchant_withdraw_records 表已就绪');
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

// 老数据里有些订单字段约束太死，会把新业务挡住，这里启动时顺手放宽。
const ensureOrderNullability = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('orders');

  const colsToRelax = [
    { name: 'merchant_id', type: DataTypes.INTEGER },
    { name: 'address', type: DataTypes.STRING(200) },
    { name: 'total_amount', type: DataTypes.DECIMAL(10, 2) },
    { name: 'pay_amount', type: DataTypes.DECIMAL(10, 2) },
    { name: 'total_price', type: DataTypes.FLOAT }
  ];
  for (const col of colsToRelax) {
    if (table[col.name] && table[col.name].allowNull === false) {
      await qi.changeColumn('orders', col.name, {
        type: col.type,
        allowNull: true
      });
      console.log(`✅ 自动迁移：已放宽 orders.${col.name} 约束`);
    }
  }
};

// 历史枚举值和新业务角色不一致时，启动时在这里补兼容。
const ensureOrderLogOperatorTypesCompatible = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('order_logs');
  if (!table.operator_type) {
    return;
  }

  await qi.changeColumn('order_logs', 'operator_type', {
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'merchant_delivery', 'system', 'dispatcher'),
    allowNull: true,
    comment: '操作人类型'
  });
  console.log('✅ 自动迁移：已补齐 order_logs.operator_type 的 merchant_delivery/dispatcher 枚举');
};

const ensureUserRoleEnumCompatible = async () => {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('users');
  if (!table.role) {
    return;
  }

  await qi.changeColumn('users', 'role', {
    type: DataTypes.ENUM('user', 'merchant', 'rider', 'merchant_delivery', 'admin'),
    allowNull: false,
    defaultValue: 'user',
    comment: '角色：user-用户，merchant-商家，rider-骑手，merchant_delivery-商家自配送员工，admin-管理员'
  });
  console.log('✅ 自动迁移：已补齐 users.role 的 merchant_delivery/admin 枚举');
};

const ensureMerchantBindingCodes = async () => {
  const merchants = await Merchant.findAll({
    where: {
      [Op.or]: [
        { binding_code: null },
        { binding_code: '' }
      ]
    },
    attributes: ['id', 'binding_code']
  });

  if (!merchants.length) {
    return;
  }

  for (const merchant of merchants) {
    const bindingCode = await generateUniqueMerchantBindingCode(async (candidate) => {
      const existing = await Merchant.findOne({
        where: { binding_code: candidate },
        attributes: ['id']
      });
      return Boolean(existing && Number(existing.id) !== Number(merchant.id));
    });

    await merchant.update({ binding_code: bindingCode });
    console.log(`✅ 自动迁移：已为 merchants.id=${merchant.id} 补齐店铺绑定ID`);
  }
};

// service_areas(服务区域表) 既要有表结构，也要有基础字典数据，所以分成“建表”和“灌种子”两步。
const ensureServiceAreasTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS service_areas (
      id INT NOT NULL AUTO_INCREMENT,
      area_code VARCHAR(32) NOT NULL,
      area_name VARCHAR(50) NOT NULL,
      area_type ENUM('county', 'town') NOT NULL,
      parent_code VARCHAR(32) NULL,
      center_lng DECIMAL(11, 8) NULL,
      center_lat DECIMAL(10, 8) NULL,
      aliases VARCHAR(255) NULL,
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

const stripServiceAreaSuffix = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.endsWith('县城')) {
    return `${text.slice(0, -2)}县`;
  }
  return text.replace(/(街道办事处|办事处|街道|镇|乡)$/u, '').trim();
};

const buildServiceAreaAliases = (item) => {
  const tokens = new Set();
  const areaName = String(item?.area_name || '').trim();
  const baseName = stripServiceAreaSuffix(areaName);
  const rawAliases = String(item?.aliases || '').trim();

  if (areaName) {
    tokens.add(areaName);
  }
  if (baseName) {
    tokens.add(baseName);
  }
  if (rawAliases) {
    rawAliases
      .split(/[,，|]/)
      .map((token) => String(token || '').trim())
      .filter(Boolean)
      .forEach((token) => tokens.add(token));
  }

  return Array.from(tokens).join(',');
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

const ensureMerchantPushDevicesTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS merchant_push_devices (
      id INT NOT NULL AUTO_INCREMENT,
      merchant_id INT NOT NULL,
      user_id INT NOT NULL,
      client_id VARCHAR(128) NOT NULL,
      app_id VARCHAR(64) NULL,
      platform VARCHAR(20) NOT NULL DEFAULT 'android',
      os_name VARCHAR(20) NULL,
      device_brand VARCHAR(50) NULL,
      device_model VARCHAR(100) NULL,
      app_version VARCHAR(50) NULL,
      app_state ENUM('foreground', 'background', 'unknown') NOT NULL DEFAULT 'unknown',
      notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
      push_enabled TINYINT(1) NOT NULL DEFAULT 1,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_push_at DATETIME NULL,
      last_push_result VARCHAR(50) NULL,
      last_error VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_merchant_push_devices_client_id (client_id),
      KEY idx_merchant_push_devices_merchant_state (merchant_id, push_enabled),
      KEY idx_merchant_push_devices_user_state (user_id, push_enabled),
      KEY idx_merchant_push_devices_last_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家推送设备绑定'
  `);
  console.log('✅ 自动迁移：merchant_push_devices 表已就绪');
};

const ensureProductDigitalProfilesTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS product_digital_profiles (
      id INT NOT NULL AUTO_INCREMENT,
      product_id INT NOT NULL,
      brand VARCHAR(50) NULL,
      model VARCHAR(100) NULL,
      storage VARCHAR(50) NULL,
      color VARCHAR(50) NULL,
      condition_grade VARCHAR(20) NULL,
      battery_health VARCHAR(20) NULL,
      network_status VARCHAR(100) NULL,
      repair_status VARCHAR(100) NULL,
      warranty_status VARCHAR(100) NULL,
      selling_points TEXT NULL,
      attrs_json TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_product_digital_profiles_product_id (product_id),
      KEY idx_product_digital_profiles_brand (brand),
      KEY idx_product_digital_profiles_condition_grade (condition_grade)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ 自动迁移：product_digital_profiles 表已就绪');
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
      center_lng: item.center_lng ?? null,
      center_lat: item.center_lat ?? null,
      aliases: buildServiceAreaAliases(item),
      is_enabled: true
    })),
    {
      updateOnDuplicate: ['area_name', 'area_type', 'parent_code', 'center_lng', 'center_lat', 'aliases', 'is_enabled', 'sort_order']
    }
  );
  console.log(`✅ 自动迁移：service_areas 基础字典已同步 ${SERVICE_AREAS.length} 条`);
};

const ensureExistingImageVariants = async () => {
  const [productRows, merchantRows] = await Promise.all([
    sequelize.query("SELECT id, images FROM products WHERE images IS NOT NULL AND images <> ''", {
      type: QueryTypes.SELECT
    }),
    sequelize.query('SELECT id, logo, cover, business_license FROM merchants', {
      type: QueryTypes.SELECT
    })
  ]);

  const candidateUrls = new Set();
  productRows.forEach((row) => {
    parseStoredImageList(row.images).forEach((url) => candidateUrls.add(url));
  });
  merchantRows.forEach((row) => {
    [row.logo, row.cover, row.business_license]
      .flatMap((value) => parseStoredImageList(value))
      .forEach((url) => candidateUrls.add(url));
  });

  let processedCount = 0;
  for (const url of candidateUrls) {
    try {
      const result = await ensureVariantsForLocalUploadUrl(url);
      if (result) {
        processedCount += 1;
      }
    } catch (error) {
      console.log(`⚠️ 图片变体补齐失败: ${url} -> ${error.message}`);
    }
  }

  console.log(`✅ 图片变体检查完成：共处理 ${processedCount} 个本地图片资源`);
};

// ==================== 最终启动区 ====================
// 这里才是真正的启动主流程：先验数据库，再补结构，再启动 Socket 和 HTTP 服务。
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接验证完成');

    await ensureServiceAreasTable();
    await ensureColumns('service_areas', [
      {
        name: 'center_lng',
        definition: {
          type: DataTypes.DECIMAL(11, 8),
          allowNull: true,
          comment: '行政区中心经度'
        }
      },
      {
        name: 'center_lat',
        definition: {
          type: DataTypes.DECIMAL(10, 8),
          allowNull: true,
          comment: '行政区中心纬度'
        }
      },
      {
        name: 'aliases',
        definition: {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: '行政区别名，逗号分隔'
        }
      }
    ]);
    await ensureServiceAreaSeeds();
    await ensureCartItemsTable();
    await ensureCountyOrderGroupsTable();
    await ensureOrderTransfersTable();
    await ensureMerchantWithdrawRecordsTable();
    await ensureTownErrandConversationsTable();
    await ensureTownErrandMessagesTable();
    await ensureUserPhoneChangeLogsTable();
    await ensureSystemNotificationsTable();
    await ensureSystemNotificationReadsTable();
    await ensureUserFeedbacksTable();
    await ensureMerchantPushDevicesTable();
    await ensureProductDigitalProfilesTable();

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
          name: 'rider_audited_by_role',
          definition: {
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: '骑手最终审核角色：admin-总后台，stationmaster-乡镇站长'
          }
        },
        {
          name: 'rider_audited_by_user_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '骑手最终审核人ID'
          }
        },
        {
          name: 'rider_audited_by_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '骑手最终审核人名称'
          }
        },
        {
          name: 'rider_audited_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '骑手审核时间'
          }
        },
        {
          name: 'rider_reject_reason',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '骑手驳回原因'
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
        },
        {
          name: 'bound_merchant_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '绑定店铺ID（商家自配送员工）'
          }
        }
      ]);

      await ensureIndexes('users', [
        {
          name: 'idx_users_bound_merchant_id',
          fields: ['bound_merchant_id']
        }
      ]);

      await dropLegacyUniquePhoneIndexes();

      await ensureColumns('merchants', [
        {
          name: 'binding_code',
          definition: {
            type: DataTypes.STRING(6),
            allowNull: true,
            comment: '店铺绑定ID，供商家自配送员工注册时输入'
          }
        },
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
        },
        {
          name: 'audited_by_role',
          definition: {
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: '最终审核角色：admin-总后台，stationmaster-乡镇站长'
          }
        },
        {
          name: 'audited_by_user_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '最终审核人用户ID'
          }
        },
        {
          name: 'audited_by_name',
          definition: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: '最终审核人名称'
          }
        },
        {
          name: 'audited_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '最终审核时间'
          }
        },
        {
          name: 'reject_reason',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '驳回原因'
          }
        },
        {
          name: 'audit_locked',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: '审核是否已锁定'
          }
        },
        {
          name: 'audit_locked_reason',
          definition: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '审核锁定原因'
          }
        }
      ]);

      await ensureMerchantBindingCodes();

      await ensureIndexes('merchants', [
        {
          name: 'uk_merchants_binding_code',
          fields: ['binding_code'],
          unique: true
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
          name: 'delivery_time_type',
          definition: {
            type: DataTypes.ENUM('asap', 'scheduled'),
            allowNull: false,
            defaultValue: 'asap',
            comment: '配送时间类型：asap-尽快送达，scheduled-预约时间'
          }
        },
        {
          name: 'scheduled_delivery_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '预约配送时间'
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
          name: 'is_transfer_order',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: '是否转派单'
          }
        },
        {
          name: 'transfer_status',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '转派状态摘要'
          }
        },
        {
          name: 'transfer_round',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '累计转派次数'
          }
        },
        {
          name: 'current_responsible_user_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '当前责任人用户ID'
          }
        },
        {
          name: 'current_responsible_role',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '当前责任人角色摘要'
          }
        },
        {
          name: 'transfer_from_user_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '最近一次转派发起人'
          }
        },
        {
          name: 'transfer_to_user_id',
          definition: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '最近一次转派目标人'
          }
        },
        {
          name: 'transfer_to_town_name',
          definition: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '最近一次目标乡镇'
          }
        },
        {
          name: 'transfer_last_action_at',
          definition: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '最近一次转派动作时间'
          }
        },
        {
          name: 'transfer_last_action_type',
          definition: {
            type: DataTypes.STRING(32),
            allowNull: true,
            comment: '最近一次转派动作类型'
          }
        },
        {
          name: 'transfer_revoke_used',
          definition: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: '是否已经使用过撤回'
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
      await ensureExistingImageVariants();

      await ensureOrderNullability();
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
