/**
 * 系统测试脚本
 * 测试订单创建、线路生成、派单等核心功能
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// HTTP 请求封装
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// 测试流程
async function runTests() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║      固始县外卖调度系统 - 功能测试            ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    try {
        // 1. 健康检查
        console.log('1️⃣  健康检查...');
        const health = await request('GET', '/api/health');
        console.log('   ✅', health.message);
        console.log('   WebSocket:', health.websocket, '\n');

        // 2. 初始化司机
        console.log('2️⃣  初始化 6 个司机...');
        const drivers = [
            { id: 'D1', name: '司机 1 号', phone: '13800138001' },
            { id: 'D2', name: '司机 2 号', phone: '13800138002' },
            { id: 'D3', name: '司机 3 号', phone: '13800138003' },
            { id: 'D4', name: '司机 4 号', phone: '13800138004' },
            { id: 'D5', name: '司机 5 号', phone: '13800138005' },
            { id: 'D6', name: '司机 6 号', phone: '13800138006' }
        ];

        for (const driver of drivers) {
            try {
                await request('POST', '/api/drivers', driver);
                console.log(`   ✅ 创建 ${driver.name}`);
            } catch (e) {
                console.log(`   ⚠️  ${driver.name} 可能已存在`);
            }
        }
        console.log();

        // 3. 创建测试订单
        console.log('3️⃣  创建测试订单...');
        const towns = ['城关镇', '汪店镇', '段集镇', '汪集镇', '三河尖镇', '郭陆滩镇'];
        const restaurants = ['肯德基', '麦当劳', '老乡鸡'];
        
        for (let i = 1; i <= 12; i++) {
            const town = towns[Math.floor(Math.random() * towns.length)];
            const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
            
            const order = {
                id: `TEST${String(i).padStart(3, '0')}`,
                restaurant: restaurant,
                restaurant_lat: 32.168 + (Math.random() - 0.5) * 0.02,
                restaurant_lon: 115.654 + (Math.random() - 0.5) * 0.02,
                customer_town: town,
                customer_lat: 32.168 + (Math.random() - 0.5) * 0.1,
                customer_lon: 115.654 + (Math.random() - 0.5) * 0.1,
                order_type: 'county'
            };
            
            try {
                await request('POST', '/api/orders', order);
                console.log(`   ✅ 订单 TEST${String(i).padStart(3, '0')}: ${restaurant} → ${town}`);
            } catch (e) {
                console.log(`   ⚠️  订单 TEST${String(i).padStart(3, '0')} 可能已存在`);
            }
        }
        console.log();

        // 4. 获取当前批次
        console.log('4️⃣  获取当前批次...');
        const batchResult = await request('GET', '/api/batches/current');
        if (batchResult.data) {
            console.log('   ✅ 批次 ID:', batchResult.data.id);
            console.log('   状态:', batchResult.data.status);
            console.log('   结束时间:', batchResult.data.end_time);
        } else {
            console.log('   ⚠️  暂无批次');
        }
        console.log();

        // 5. 获取待配送订单
        console.log('5️⃣  获取待配送订单...');
        const ordersResult = await request('GET', '/api/orders/pending/list');
        console.log('   ✅ 待配送订单数:', ordersResult.count);
        console.log();

        // 6. 生成配送线路
        console.log('6️⃣  生成配送线路...');
        const routesResult = await request('POST', '/api/routes/generate', {
            batchId: batchResult.data?.id || null
        });
        
        if (routesResult.success && routesResult.data.routes) {
            console.log('   ✅ 生成线路数:', routesResult.data.routes.length);
            console.log('   总订单数:', routesResult.data.totalOrders);
            
            routesResult.data.routes.forEach((route, index) => {
                console.log(`   📍 线路 ${index + 1}: ${route.orderCount}单 | ${route.totalDistance}km | ${route.estimatedTime}分钟`);
            });
            
            console.log('\n   📊 线路报告:');
            console.log('   ─────────────────────────────────────');
            routesResult.report.split('\n').forEach(line => {
                if (line.trim()) console.log('   ' + line);
            });
        } else {
            console.log('   ⚠️  线路生成失败:', routesResult.message || routesResult.data?.message);
        }
        console.log();

        // 7. 获取所有司机
        console.log('7️⃣  获取所有司机...');
        const allDrivers = await request('GET', '/api/drivers');
        console.log('   ✅ 司机数量:', allDrivers.count);
        allDrivers.data.forEach(driver => {
            console.log(`   🚗 ${driver.name} (${driver.id}): ${driver.status}`);
        });
        console.log();

        console.log('╔════════════════════════════════════════════════╗');
        console.log('║              ✅ 测试全部完成！                 ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('\n💡 提示：访问 http://localhost:3000 查看调度台界面');
        console.log('💡 提示：访问 http://localhost:3000/driver.html 查看司机端');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('   请确保服务器已启动：npm start');
    }
}

// 运行测试
runTests();
