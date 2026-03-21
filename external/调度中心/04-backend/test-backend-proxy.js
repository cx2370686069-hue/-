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
    console.log('║      后端 GraphHopper 代理接口测试              ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    try {
        // 1. 健康检查
        console.log('1️⃣  后端健康检查...');
        const health = await request('GET', '/api/health');
        if (health.success) {
            console.log('   ✅ 后端服务正常运行\n');
        } else {
            console.log('   ❌ 后端服务异常\n');
            console.log('   💡 请启动后端: npm start');
            return;
        }

        // 2. 测试 GraphHopper 路线规划代理
        console.log('2️⃣  测试 GraphHopper 路线规划代理...');
        console.log('   📡 请求: POST /api/graphhopper/route');
        console.log('   📍 参数: 固始县政府 → 测试终点\n');
        
        const routeResult = await request('POST', '/api/graphhopper/route', {
            points: [
                [115.654, 32.168],  // 固始县政府
                [115.664, 32.178]   // 测试终点
            ],
            vehicle: 'car',
            locale: 'zh-CN',
            instructions: true,
            calc_points: true,
            points_encoded: false
        });

        if (routeResult.success) {
            const path = routeResult.data.paths[0];
            const distanceKm = (path.distance / 1000).toFixed(2);
            const durationMin = Math.round(path.time / 60000);
            
            console.log('   ✅ 代理接口调用成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            console.log(`   🧭 导航指引: ${path.instructions?.length || 0} 条\n`);
        } else {
            console.log('   ❌ 代理接口调用失败');
            console.log(`   错误信息: ${routeResult.message}`);
            
            if (routeResult.message && routeResult.message.includes('ECONNREFUSED')) {
                console.log('\n   💡 GraphHopper 服务未启动');
                console.log('   💡 请安装 Docker 并运行: start-graphhopper.bat');
            } else if (routeResult.message && routeResult.message.includes('ETIMEDOUT')) {
                console.log('\n   💡 GraphHopper 服务响应超时');
                console.log('   💡 请检查服务状态: docker-compose ps');
            }
            console.log('');
        }

        // 3. 测试 GraphHopper 导航代理
        console.log('3️⃣  测试 GraphHopper 导航代理...');
        console.log('   📡 请求: POST /api/graphhopper/navigate');
        console.log('   📍 参数: 固始县政府 → 测试终点\n');
        
        const navigateResult = await request('POST', '/api/graphhopper/navigate', {
            start: [115.654, 32.168],
            end: [115.664, 32.178],
            vehicle: 'car',
            locale: 'zh-CN'
        });

        if (navigateResult.success) {
            const data = navigateResult.data;
            const distanceKm = (data.distance / 1000).toFixed(2);
            const durationMin = Math.round(data.time / 60000);
            
            console.log('   ✅ 导航代理接口调用成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            console.log(`   🧭 导航指引: ${data.instructions?.length || 0} 条\n`);
            
            if (data.instructions && data.instructions.length > 0) {
                console.log('   📋 前 3 条语音导航指引:');
                data.instructions.slice(0, 3).forEach((inst, index) => {
                    console.log(`      ${index + 1}. ${inst.text}`);
                    console.log(`         📍 ${inst.street_name || '未知道路'} | 📏 ${(inst.distance / 1000).toFixed(2)}km`);
                });
                console.log('');
            }
        } else {
            console.log('   ❌ 导航代理接口调用失败');
            console.log(`   错误信息: ${navigateResult.message}\n`);
        }

        // 4. 测试 GraphHopper TSP 优化代理
        console.log('4️⃣  测试 GraphHopper TSP 优化代理...');
        console.log('   📡 请求: POST /api/graphhopper/tsp');
        console.log('   📍 参数: 4 个点自动排序\n');
        
        const tspResult = await request('POST', '/api/graphhopper/tsp', {
            points: [
                [115.654, 32.168],
                [115.660, 32.170],
                [115.665, 32.175],
                [115.670, 32.180]
            ],
            vehicle: 'car',
            locale: 'zh-CN'
        });

        if (tspResult.success) {
            const data = tspResult.data;
            const distanceKm = (data.distance / 1000).toFixed(2);
            const durationMin = Math.round(data.time / 60000);
            
            console.log('   ✅ TSP 优化代理接口调用成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟\n`);
        } else {
            console.log('   ❌ TSP 优化代理接口调用失败');
            console.log(`   错误信息: ${tspResult.message}\n`);
        }

        console.log('╔════════════════════════════════════════════════╗');
        console.log('║              ✅ 后端代理接口测试完成！           ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('\n💡 提示：');
        console.log('   - 后端服务: http://localhost:3000');
        console.log('   - GraphHopper 代理: /api/graphhopper/*');
        console.log('   - 天地图代理: /api/tianditu/*');
        console.log('\n⚠️  注意：');
        console.log('   - GraphHopper 服务未启动时，代理接口会返回连接错误');
        console.log('   - 安装 Docker 后运行: start-graphhopper.bat 启动 GraphHopper');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('\n💡 请确保：');
        console.error('   1. 后端服务已启动: npm start');
        console.error('   2. 后端运行在 http://localhost:3000');
    }
}

// 运行测试
runTests();
