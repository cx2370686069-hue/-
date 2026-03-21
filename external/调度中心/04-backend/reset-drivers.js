/**
 * 重置司机为 4 个
 */

const { run, query } = require('./database/db');

async function resetDrivers() {
    console.log('🔄 开始重置司机...\n');
    
    // 1. 清空司机表
    console.log('📋 清空司机表...');
    await run('DELETE FROM drivers');
    console.log('✅ 司机表已清空\n');
    
    // 2. 添加 4 个司机
    const drivers = [
        { id: 'D1', name: '1 号司机', phone: '13800138001' },
        { id: 'D2', name: '2 号司机', phone: '13800138002' },
        { id: 'D3', name: '3 号司机', phone: '13800138003' },
        { id: 'D4', name: '4 号司机', phone: '13800138004' }
    ];
    
    console.log('🚗 添加 4 个司机...');
    for (const driver of drivers) {
        await run(`
            INSERT INTO drivers (id, name, phone, status, created_at)
            VALUES (?, ?, ?, 'free', CURRENT_TIMESTAMP)
        `, [driver.id, driver.name, driver.phone]);
        console.log(`   ✅ ${driver.name} (${driver.phone})`);
    }
    
    console.log('\n✅ 司机重置完成！\n');
    
    // 3. 验证结果
    const result = await query('SELECT * FROM drivers');
    console.log(`📊 当前司机数量：${result.length}`);
    result.forEach(driver => {
        console.log(`   - ${driver.id}: ${driver.name} (${driver.phone})`);
    });
}

// 执行
resetDrivers().catch(console.error);
