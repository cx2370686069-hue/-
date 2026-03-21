/**
 * 数据库配置
 * 使用 SQLite 轻量级数据库
 */

let sqlite3;
let db = null;
let sqliteInitError = null;

// 说明：在部分服务器环境下，sqlite3 依赖的原生二进制可能因架构/Node版本/系统库不匹配
// 而加载失败（如 ERR_DLOPEN_FAILED / invalid ELF header）。
// 为了不让天地图导航这类“非数据库功能”整体瘫痪，这里让后端在失败时仍能启动。
try {
    sqlite3 = require('sqlite3').verbose();
} catch (err) {
    sqliteInitError = err;
    console.error('❌ sqlite3 原生模块加载失败，数据库功能将不可用：', err.message || err);
}
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'gushi_delivery.db');

// 创建数据库连接（仅当 sqlite3 可用时）
if (sqlite3) {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            sqliteInitError = err;
            console.error('数据库连接失败:', err.message);
        } else {
            console.log('✅ 数据库连接成功');
            initTables();
        }
    });
}

/**
 * 初始化数据表
 */
function initTables() {
    // 订单表
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            restaurant TEXT NOT NULL,
            restaurant_lat REAL NOT NULL,
            restaurant_lon REAL NOT NULL,
            customer_town TEXT NOT NULL,
            customer_lat REAL NOT NULL,
            customer_lon REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            order_type TEXT DEFAULT 'county',
            batch_id INTEGER,
            rider_id TEXT,
            driver_id TEXT,
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            assign_time DATETIME,
            complete_time DATETIME,
            real_distance REAL,
            real_duration INTEGER
        )
    `, (err) => {
        if (err) console.error('创建订单表失败:', err);
        else console.log('✅ 订单表已就绪');
    });

    // 骑手表
    db.run(`
        CREATE TABLE IF NOT EXISTS riders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            status TEXT DEFAULT 'free',
            lat REAL,
            lon REAL,
            online_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_orders INTEGER DEFAULT 0,
            rating REAL DEFAULT 5.0
        )
    `, (err) => {
        if (err) console.error('创建骑手表失败:', err);
        else console.log('✅ 骑手表已就绪');
    });

    // 司机表（新增）
    db.run(`
        CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            status TEXT DEFAULT 'free',
            current_lat REAL,
            current_lon REAL,
            vehicle_type TEXT DEFAULT 'van',
            max_capacity INTEGER DEFAULT 20,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('创建司机表失败:', err);
        else console.log('✅ 司机表已就绪');
    });

    // 批次表（新增）
    db.run(`
        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            status TEXT DEFAULT 'collecting',
            total_orders INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('创建批次表失败:', err);
        else console.log('✅ 批次表已就绪');
    });

    // 线路表（新增）
    db.run(`
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER,
            driver_id TEXT,
            orders TEXT,
            path TEXT,
            estimated_distance REAL,
            estimated_time INTEGER,
            actual_distance REAL,
            actual_time INTEGER,
            status TEXT DEFAULT 'planned',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES batches(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )
    `, (err) => {
        if (err) console.error('创建线路表失败:', err);
        else console.log('✅ 线路表已就绪');
    });

    // 配送记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            rider_id TEXT,
            driver_id TEXT,
            route_id INTEGER,
            start_time DATETIME,
            end_time DATETIME,
            distance REAL,
            duration INTEGER,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (rider_id) REFERENCES riders(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id),
            FOREIGN KEY (route_id) REFERENCES routes(id)
        )
    `, (err) => {
        if (err) console.error('创建配送记录表失败:', err);
        else console.log('✅ 配送记录表已就绪');
    });
}

/**
 * 执行 SQL 查询（返回 Promise）
 */
function query(sql, params = []) {
    if (!db) {
        return Promise.reject(sqliteInitError || new Error('数据库不可用'));
    }
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * 执行 SQL 命令（插入/更新/删除）
 */
function run(sql, params = []) {
    if (!db) {
        return Promise.reject(sqliteInitError || new Error('数据库不可用'));
    }
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

module.exports = {
    db,
    query,
    run
};
