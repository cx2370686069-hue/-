/**
 * 数据库迁移脚本
 * 为现有数据库添加新字段
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'gushi_delivery.db');
const db = new sqlite3.Database(dbPath);

console.log('正在迁移数据库...\n');

// 添加 order_type 字段
db.run(`
    ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'county'
`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('⚠️  order_type 字段已存在');
        } else {
            console.log('✅ 添加 order_type 字段成功');
        }
    } else {
        console.log('✅ 添加 order_type 字段成功');
    }
});

// 添加 batch_id 字段
db.run(`
    ALTER TABLE orders ADD COLUMN batch_id INTEGER
`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('⚠️  batch_id 字段已存在');
        } else {
            console.log('✅ 添加 batch_id 字段成功');
        }
    } else {
        console.log('✅ 添加 batch_id 字段成功');
    }
});

// 添加 driver_id 字段
db.run(`
    ALTER TABLE orders ADD COLUMN driver_id TEXT
`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('⚠️  driver_id 字段已存在');
        } else {
            console.log('✅ 添加 driver_id 字段成功');
        }
    } else {
        console.log('✅ 添加 driver_id 字段成功');
    }
});

// 关闭连接
setTimeout(() => {
    db.close();
    console.log('\n✅ 数据库迁移完成！');
    console.log('💡 请重启服务器使更改生效\n');
}, 1000);
