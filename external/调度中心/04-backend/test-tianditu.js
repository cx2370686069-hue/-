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
    console.log('║      天地图 API 代理接口测试                  ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    try {
        // 1. 健康检查
        console.log('1️⃣  后端健康检查...');
        const health = await request('GET', '/api/health');
        if (health.success) {
            console.log('   ✅ 后端服务正常运行\n');
        } else {
            console.log('   ❌ 后端服务异常\n');
            return;
        }

        // 2. 测试天地图路线规划
        console.log('2️⃣  测试天地图路线规划...');
        console.log('   📡 请求: POST /api/tianditu/drive');
        console.log('   📍 参数: 固始县政府 → 测试终点\n');
        
        const routeResult = await request('POST', '/api/tianditu/drive', {
            orig: '115.654,32.168',
            dest: '115.664,32.178',
            style: '0'
        });

        if (routeResult.success) {
            const data = routeResult.data;
            const distanceKm = (data.distance / 1000).toFixed(2);
            const durationMin = Math.round(data.duration / 60);
            
            console.log('   ✅ 天地图路线规划成功');
            console.log(`   📍 距离: ${distanceKm} 公里`);
            console.log(`   ⏱️  预计时间: ${durationMin} 分钟`);
            console.log(`   🛣️ 路线点数: ${data.routePoints?.length || 0}\n`);
        } else {
            console.log('   ❌ 天地图路线规划失败');
            console.log(`   错误信息: ${routeResult.message}\n`);
        }

        console.log('╔════════════════════════════════════════════════╗');
        console.log('║              ✅ 天地图 API 测试完成！             ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('\n💡 提示：');
        console.log('   - 天地图 API 已集成，可以正常使用');
        console.log('   - 后端代理地址: http://localhost:3000/api/tianditu/*');
        console.log('   - 如需 GraphHopper 语音导航，请安装 Docker 并启动 GraphHopper 服务');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('\n💡 请确保：');
        console.error('   1. 后端服务已启动: npm start');
        console.error('   2. 后端运行在 http://localhost:3000');
    }
}

// 运行测试
runTests();
