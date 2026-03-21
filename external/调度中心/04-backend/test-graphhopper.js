const http = require('http');

const BASE_URL = 'http://localhost:8989';

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
    console.log('║      GraphHopper 本地服务 - 功能测试                ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    try {
        // 1. 健康检查
        console.log('1️⃣  健康检查...');
        const health = await request('GET', '/health');
        if (health.status === 'ok') {
            console.log('   ✅ GraphHopper 服务正常运行');
            console.log(`   📌 版本: ${health.version || '未知'}\n`);
        } else {
            console.log('   ❌ GraphHopper 服务异常\n');
            console.log('   💡 请先启动 GraphHopper: docker-compose up -d');
            return;
        }

        // 2. 测试路线规划（固始县政府 → 测试终点）
        console.log('2️⃣  测试路线规划...');
        const routeResult = await request('POST', '/route', {
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

        if (routeResult.paths && routeResult.paths.length > 0) {
            const path = routeResult.paths[0];
            const distanceKm = (path.distance / 1000).toFixed(2);
            const durationMin = Math.round(path.time / 60000);
            
            console.log('   ✅ 路线规划成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            console.log(`   🧭 导航指引: ${path.instructions?.length || 0} 条`);
            console.log(`   🛣️ 路线点数: ${path.points?.length || 0}\n`);
        } else {
            console.log('   ❌ 路线规划失败');
            console.log(`   错误信息: ${JSON.stringify(routeResult)}\n`);
        }

        // 3. 测试导航（含语音指引）
        console.log('3️⃣  测试导航指引...');
        if (routeResult.paths && routeResult.paths.length > 0) {
            const path = routeResult.paths[0];
            if (path.instructions && path.instructions.length > 0) {
                console.log('   ✅ 导航指引获取成功');
                console.log('   📋 前 5 条导航指引:');
                path.instructions.slice(0, 5).forEach((inst, index) => {
                    console.log(`      ${index + 1}. ${inst.text}`);
                    console.log(`         📍 ${inst.street_name || '未知道路'} | 📏 ${(inst.distance / 1000).toFixed(2)}km | ⏱️ ${Math.round(inst.time / 60000)}分钟`);
                });
                console.log('');
            } else {
                console.log('   ⚠️  未获取到导航指引\n');
            }
        }

        // 4. 测试多点路线规划
        console.log('4️⃣  测试多点路线规划...');
        const multiPointResult = await request('POST', '/route', {
            points: [
                [115.654, 32.168],  // 起点
                [115.660, 32.170],  // 途经点1
                [115.665, 32.175],  // 途经点2
                [115.670, 32.180]   // 终点
            ],
            vehicle: 'car',
            locale: 'zh-CN',
            instructions: true,
            calc_points: true,
            points_encoded: false
        });

        if (multiPointResult.paths && multiPointResult.paths.length > 0) {
            const path = multiPointResult.paths[0];
            const distanceKm = (path.distance / 1000).toFixed(2);
            const durationMin = Math.round(path.time / 60000);
            
            console.log('   ✅ 多点路线规划成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            console.log(`   🛣️ 路线点数: ${path.points?.length || 0}\n`);
        } else {
            console.log('   ❌ 多点路线规划失败\n');
        }

        // 5. 测试 TSP 优化（旅行商问题）
        console.log('5️⃣  测试 TSP 优化（自动排序）...');
        const tspResult = await request('POST', '/route', {
            points: [
                [115.654, 32.168],
                [115.660, 32.170],
                [115.665, 32.175],
                [115.670, 32.180]
            ],
            vehicle: 'car',
            locale: 'zh-CN',
            'ch.disable': true,
            optimize: true,
            instructions: true,
            calc_points: true,
            points_encoded: false
        });

        if (tspResult.paths && tspResult.paths.length > 0) {
            const path = tspResult.paths[0];
            const distanceKm = (path.distance / 1000).toFixed(2);
            const durationMin = Math.round(path.time / 60000);
            
            console.log('   ✅ TSP 优化成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            
            if (tspResult.snapped_waypoints) {
                console.log('   🔄 优化后的访问顺序:');
                tspResult.snapped_waypoints.forEach((wp, index) => {
                    console.log(`      ${index + 1}. [${wp.lon.toFixed(6)}, ${wp.lat.toFixed(6)}]`);
                });
            }
            console.log('');
        } else {
            console.log('   ❌ TSP 优化失败\n');
        }

        // 6. 测试不同交通方式
        console.log('6️⃣  测试不同交通方式...');
        const vehicles = ['car', 'bike', 'foot'];
        for (const vehicle of vehicles) {
            const vehicleResult = await request('POST', '/route', {
                points: [
                    [115.654, 32.168],
                    [115.664, 32.178]
                ],
                vehicle: vehicle,
                locale: 'zh-CN',
                instructions: false,
                calc_points: false
            });

            if (vehicleResult.paths && vehicleResult.paths.length > 0) {
                const path = vehicleResult.paths[0];
                const distanceKm = (path.distance / 1000).toFixed(2);
                const durationMin = Math.round(path.time / 60000);
                const vehicleName = vehicle === 'car' ? '驾车' : vehicle === 'bike' ? '骑行' : '步行';
                console.log(`   ✅ ${vehicleName}: ${distanceKm}km, ${durationMin}分钟`);
            }
        }
        console.log('');

        console.log('╔════════════════════════════════════════════════╗');
        console.log('║              ✅ 所有测试完成！                     ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('\n💡 提示：');
        console.log('   - GraphHopper 服务地址: http://localhost:8989');
        console.log('   - 后端代理地址: http://localhost:3000/api/graphhopper/*');
        console.log('   - 查看日志: docker-compose logs -f graphhopper');
        console.log('   - 停止服务: docker-compose down');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('\n💡 请确保：');
        console.error('   1. GraphHopper 服务已启动: docker-compose up -d');
        console.error('   2. 服务运行在 http://localhost:8989');
        console.error('   3. 地图数据已加载完成（首次启动需要 5-10 分钟）');
    }
}

// 运行测试
runTests();
