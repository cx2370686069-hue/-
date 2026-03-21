/**
 * 服务器端集成测试脚本
 * 测试天地图 + GraphHopper 路径规划功能
 * 适用于阿里云服务器部署后的测试
 */

const http = require('http');

// 配置：可以通过环境变量覆盖
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const GRAPHHOPPER_URL = process.env.GRAPHHOPPER_URL || 'http://localhost:8989';

// 测试坐标点（固始县区域）
const TEST_POINTS = {
    origin: { lon: 115.654, lat: 32.168, name: '固始县政府' },
    dest1: { lon: 115.664, lat: 32.178, name: '测试点1' },
    dest2: { lon: 115.670, lat: 32.180, name: '测试点2' },
    dest3: { lon: 115.660, lat: 32.170, name: '测试点3' }
};

// HTTP 请求封装
function request(method, url, data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
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

// 格式化距离和时间
function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters.toFixed(0)} 米`;
    }
    return `${(meters / 1000).toFixed(2)} 公里`;
}

function formatTime(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} 分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} 小时 ${mins} 分钟`;
}

// 测试1：后端健康检查
async function testBackendHealth() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试1：后端健康检查');
    console.log('='.repeat(60));
    
    try {
        const result = await request('GET', `${BACKEND_URL}/api/health`);
        
        if (result.success) {
            console.log('✅ 后端服务正常');
            console.log(`   📡 地址: ${BACKEND_URL}`);
            console.log(`   💬 WebSocket: ${result.websocket}`);
            console.log(`   ⏰ 时间: ${result.timestamp}`);
            return true;
        } else {
            console.log('❌ 后端服务异常');
            console.log(`   错误: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 无法连接后端服务');
        console.log(`   错误: ${error.message}`);
        console.log(`   💡 请确保后端服务已启动在 ${BACKEND_URL}`);
        return false;
    }
}

// 测试2：GraphHopper健康检查
async function testGraphHopperHealth() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试2：GraphHopper健康检查');
    console.log('='.repeat(60));
    
    try {
        const result = await request('GET', `${GRAPHHOPPER_URL}/health`);
        
        if (result.status === 'ok') {
            console.log('✅ GraphHopper服务正常');
            console.log(`   📡 地址: ${GRAPHHOPPER_URL}`);
            console.log(`   📌 版本: ${result.version || '未知'}`);
            console.log(`   ⏰ 时间: ${result.took || '未知'}ms`);
            return true;
        } else {
            console.log('❌ GraphHopper服务异常');
            console.log(`   状态: ${result.status}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 无法连接GraphHopper服务');
        console.log(`   错误: ${error.message}`);
        console.log(`   💡 请确保GraphHopper已启动在 ${GRAPHHOPPER_URL}`);
        console.log(`   💡 启动命令: docker-compose up -d`);
        return false;
    }
}

// 测试3：天地图路线规划（通过后端代理）
async function testTiandituRoute() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试3：天地图路线规划（后端代理）');
    console.log('='.repeat(60));
    
    try {
        console.log(`📍 起点: ${TEST_POINTS.origin.name} (${TEST_POINTS.origin.lon}, ${TEST_POINTS.origin.lat})`);
        console.log(`📍 终点: ${TEST_POINTS.dest1.name} (${TEST_POINTS.dest1.lon}, ${TEST_POINTS.dest1.lat})`);
        
        const result = await request('POST', `${BACKEND_URL}/api/tianditu/drive`, {
            orig: `${TEST_POINTS.origin.lon},${TEST_POINTS.origin.lat}`,
            dest: `${TEST_POINTS.dest1.lon},${TEST_POINTS.dest1.lat}`,
            style: '0'
        });
        
        if (result.success) {
            const data = result.data;
            console.log('✅ 天地图路线规划成功');
            console.log(`   📏 距离: ${formatDistance(data.distance)}`);
            console.log(`   ⏱️  预计时间: ${formatTime(data.duration)}`);
            console.log(`   🛣️ 路线点数: ${data.routePoints?.length || 0}`);
            return true;
        } else {
            console.log('❌ 天地图路线规划失败');
            console.log(`   错误: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 天地图路线规划异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 测试4：GraphHopper路线规划（通过后端代理）
async function testGraphHopperRoute() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试4：GraphHopper路线规划（后端代理）');
    console.log('='.repeat(60));
    
    try {
        console.log(`📍 起点: ${TEST_POINTS.origin.name} (${TEST_POINTS.origin.lon}, ${TEST_POINTS.origin.lat})`);
        console.log(`📍 终点: ${TEST_POINTS.dest1.name} (${TEST_POINTS.dest1.lon}, ${TEST_POINTS.dest1.lat})`);
        
        const result = await request('POST', `${BACKEND_URL}/api/graphhopper/route`, {
            points: [
                [TEST_POINTS.origin.lon, TEST_POINTS.origin.lat],
                [TEST_POINTS.dest1.lon, TEST_POINTS.dest1.lat]
            ],
            profile: 'car',
            locale: 'zh-CN',
            instructions: true,
            calc_points: true,
            points_encoded: false
        });
        
        if (result.success && result.data.paths && result.data.paths.length > 0) {
            const path = result.data.paths[0];
            console.log('✅ GraphHopper路线规划成功');
            console.log(`   📏 距离: ${formatDistance(path.distance)}`);
            console.log(`   ⏱️  预计时间: ${formatTime(path.time)}`);
            console.log(`   🧭 导航指引: ${path.instructions?.length || 0} 条`);
            console.log(`   🛣️ 路线点数: ${path.points?.length || 0}`);
            
            // 显示前3条导航指引
            if (path.instructions && path.instructions.length > 0) {
                console.log('\n   📋 导航指引（前3条）:');
                path.instructions.slice(0, 3).forEach((inst, index) => {
                    console.log(`      ${index + 1}. ${inst.text}`);
                    console.log(`         📍 ${inst.street_name || '未知道路'} | 📏 ${formatDistance(inst.distance)} | ⏱️ ${formatTime(inst.time)}`);
                });
            }
            return true;
        } else {
            console.log('❌ GraphHopper路线规划失败');
            console.log(`   错误: ${result.message || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ GraphHopper路线规划异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 测试5：GraphHopper导航（含语音指引）
async function testGraphHopperNavigation() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试5：GraphHopper导航（含语音指引）');
    console.log('='.repeat(60));
    
    try {
        console.log(`📍 起点: ${TEST_POINTS.origin.name} (${TEST_POINTS.origin.lon}, ${TEST_POINTS.origin.lat})`);
        console.log(`📍 终点: ${TEST_POINTS.dest1.name} (${TEST_POINTS.dest1.lon}, ${TEST_POINTS.dest1.lat})`);
        
        const result = await request('POST', `${BACKEND_URL}/api/graphhopper/navigate`, {
            start: [TEST_POINTS.origin.lon, TEST_POINTS.origin.lat],
            end: [TEST_POINTS.dest1.lon, TEST_POINTS.dest1.lat],
            profile: 'car',
            locale: 'zh-CN'
        });
        
        if (result.success) {
            const data = result.data;
            console.log('✅ GraphHopper导航成功');
            console.log(`   📏 距离: ${formatDistance(data.distance)}`);
            console.log(`   ⏱️  预计时间: ${formatTime(data.time)}`);
            console.log(`   🧭 导航指引: ${data.instructions?.length || 0} 条`);
            
            // 显示所有语音指引
            if (data.instructions && data.instructions.length > 0) {
                console.log('\n   🎤 语音导航指引:');
                data.instructions.forEach((inst, index) => {
                    console.log(`      ${index + 1}. ${inst.voice_instructions || inst.text}`);
                    console.log(`         📍 ${inst.street_name || '未知道路'} | 📏 ${formatDistance(inst.distance)} | ⏱️ ${formatTime(inst.time)}`);
                });
            }
            return true;
        } else {
            console.log('❌ GraphHopper导航失败');
            console.log(`   错误: ${result.message || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ GraphHopper导航异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 测试6：多点路线规划（模拟外卖配送）
async function testMultiPointRoute() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试6：多点路线规划（模拟外卖配送）');
    console.log('='.repeat(60));
    
    try {
        const points = [
            [TEST_POINTS.origin.lon, TEST_POINTS.origin.lat],
            [TEST_POINTS.dest1.lon, TEST_POINTS.dest1.lat],
            [TEST_POINTS.dest2.lon, TEST_POINTS.dest2.lat],
            [TEST_POINTS.dest3.lon, TEST_POINTS.dest3.lat]
        ];
        
        console.log(`📍 配送路线:`);
        points.forEach((p, i) => {
            const name = i === 0 ? '起点' : `配送点${i}`;
            console.log(`   ${i + 1}. ${name}: [${p[0]}, ${p[1]}]`);
        });
        
        const result = await request('POST', `${BACKEND_URL}/api/graphhopper/route`, {
            points: points,
            profile: 'car',
            locale: 'zh-CN',
            instructions: true,
            calc_points: true,
            points_encoded: false
        });
        
        if (result.success && result.data.paths && result.data.paths.length > 0) {
            const path = result.data.paths[0];
            console.log('✅ 多点路线规划成功');
            console.log(`   📏 总距离: ${formatDistance(path.distance)}`);
            console.log(`   ⏱️  总预计时间: ${formatTime(path.time)}`);
            console.log(`   🧭 导航指引: ${path.instructions?.length || 0} 条`);
            console.log(`   🛣️ 路线点数: ${path.points?.length || 0}`);
            return true;
        } else {
            console.log('❌ 多点路线规划失败');
            console.log(`   错误: ${result.message || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 多点路线规划异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 测试7：TSP优化（自动排序配送点）
async function testTSPOptimization() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试7：TSP优化（自动排序配送点）');
    console.log('='.repeat(60));
    
    try {
        const points = [
            [TEST_POINTS.dest1.lon, TEST_POINTS.dest1.lat],
            [TEST_POINTS.dest2.lon, TEST_POINTS.dest2.lat],
            [TEST_POINTS.dest3.lon, TEST_POINTS.dest3.lat]
        ];
        
        console.log(`📍 原始配送点（未排序）:`);
        points.forEach((p, i) => {
            console.log(`   ${i + 1}. 配送点${i + 1}: [${p[0]}, ${p[1]}]`);
        });
        
        const result = await request('POST', `${BACKEND_URL}/api/graphhopper/tsp`, {
            points: points,
            profile: 'car',
            locale: 'zh-CN'
        });
        
        if (result.success) {
            const data = result.data;
            console.log('✅ TSP优化成功');
            console.log(`   📏 优化后距离: ${formatDistance(data.distance)}`);
            console.log(`   ⏱️  优化后时间: ${formatTime(data.time)}`);
            
            if (data.snapped_waypoints) {
                console.log(`\n   🔄 优化后的访问顺序:`);
                data.snapped_waypoints.forEach((wp, index) => {
                    console.log(`      ${index + 1}. [${wp.lon.toFixed(6)}, ${wp.lat.toFixed(6)}]`);
                });
            }
            return true;
        } else {
            console.log('❌ TSP优化失败');
            console.log(`   错误: ${result.message || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ TSP优化异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 测试8：不同交通方式对比
async function testDifferentVehicles() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 测试8：不同交通方式对比');
    console.log('='.repeat(60));
    
    try {
        const vehicles = [
            { profile: 'car', name: '驾车' },
            { profile: 'bike', name: '骑行' },
            { profile: 'foot', name: '步行' }
        ];
        
        console.log(`📍 路线: ${TEST_POINTS.origin.name} → ${TEST_POINTS.dest1.name}`);
        console.log('');
        
        let allSuccess = true;
        
        for (const vehicle of vehicles) {
            const result = await request('POST', `${BACKEND_URL}/api/graphhopper/route`, {
                points: [
                    [TEST_POINTS.origin.lon, TEST_POINTS.origin.lat],
                    [TEST_POINTS.dest1.lon, TEST_POINTS.dest1.lat]
                ],
                profile: vehicle.profile,
                locale: 'zh-CN',
                instructions: false,
                calc_points: false
            });
            
            if (result.success && result.data.paths && result.data.paths.length > 0) {
                const path = result.data.paths[0];
                console.log(`✅ ${vehicle.name}: ${formatDistance(path.distance)} | ${formatTime(path.time)}`);
            } else {
                console.log(`❌ ${vehicle.name}: 失败`);
                allSuccess = false;
            }
        }
        
        return allSuccess;
    } catch (error) {
        console.log('❌ 交通方式测试异常');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

// 主测试流程
async function runAllTests() {
    console.log('\n' + '█'.repeat(60));
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█' + '  天地图 + GraphHopper 服务器端集成测试'.padStart(56) + '  █');
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█'.repeat(60));
    
    console.log('\n📋 测试配置:');
    console.log(`   📡 后端地址: ${BACKEND_URL}`);
    console.log(`   🗺️  GraphHopper地址: ${GRAPHHOPPER_URL}`);
    console.log(`   🌐 测试区域: 固始县`);
    
    const results = {
        backendHealth: await testBackendHealth(),
        graphhopperHealth: await testGraphHopperHealth(),
        tiandituRoute: await testTiandituRoute(),
        graphhopperRoute: await testGraphHopperRoute(),
        graphhopperNavigation: await testGraphHopperNavigation(),
        multiPointRoute: await testMultiPointRoute(),
        tspOptimization: await testTSPOptimization(),
        differentVehicles: await testDifferentVehicles()
    };
    
    // 测试结果汇总
    console.log('\n' + '█'.repeat(60));
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█' + '  测试结果汇总'.padStart(56) + '  █');
    console.log('█' + ' '.repeat(58) + '█');
    console.log('█'.repeat(60));
    
    const testNames = {
        backendHealth: '后端健康检查',
        graphhopperHealth: 'GraphHopper健康检查',
        tiandituRoute: '天地图路线规划',
        graphhopperRoute: 'GraphHopper路线规划',
        graphhopperNavigation: 'GraphHopper导航',
        multiPointRoute: '多点路线规划',
        tspOptimization: 'TSP优化',
        differentVehicles: '不同交通方式对比'
    };
    
    let passCount = 0;
    let failCount = 0;
    
    Object.entries(results).forEach(([key, passed]) => {
        const status = passed ? '✅ 通过' : '❌ 失败';
        console.log(`   ${status} ${testNames[key]}`);
        if (passed) passCount++;
        else failCount++;
    });
    
    console.log('\n📊 统计:');
    console.log(`   ✅ 通过: ${passCount}/${Object.keys(results).length}`);
    console.log(`   ❌ 失败: ${failCount}/${Object.keys(results).length}`);
    
    if (failCount === 0) {
        console.log('\n🎉 所有测试通过！系统可以正常使用。');
    } else {
        console.log('\n⚠️  部分测试失败，请检查相关服务。');
    }
    
    console.log('\n' + '█'.repeat(60) + '\n');
    
    return failCount === 0;
}

// 运行测试
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ 测试执行异常:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };
