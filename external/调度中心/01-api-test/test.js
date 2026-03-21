/**
 * 天地图驾车路径规划 API 测试
 * 用于计算固始县内两个地点之间的驾车距离和时间
 */

const https = require('https');

// ==================== 配置区域 ====================
// 请在这里填入你的天地图 API 密钥
const TIANDITU_KEY = '66b24ca27c124253d7273c7da0af8818';

// 测试坐标（固始县示例）
// 格式：经度,纬度
const START_POINT = '115.654,32.168';  // 固始县政府附近
const END_POINT = '115.712,32.058';    // 段集镇附近

// ==================== API 调用函数 ====================

/**
 * 调用天地图驾车路径规划 API
 * @param {string} start - 起点坐标 "经度,纬度"
 * @param {string} end - 终点坐标 "经度,纬度"
 * @param {string} key - 天地图 API 密钥
 */
function getDrivingRoute(start, end, key) {
    return new Promise((resolve, reject) => {
        // 检查密钥
        if (!key || key === 'YOUR_KEY_HERE') {
            reject(new Error('请先填写天地图 API 密钥 (TIANDITU_KEY)'));
            return;
        }

        // 构建 postStr 参数（JSON格式）
        const postStrObj = {
            orig: start,    // 起点
            dest: end,      // 终点
            style: "0"      // 路线类型：0-最快路线，1-最短路线，2-避开高速
        };
        
        // 构建完整 URL
        const postStr = JSON.stringify(postStrObj);
        const url = `https://api.tianditu.gov.cn/drive?postStr=${encodeURIComponent(postStr)}&type=search&tk=${key}`;
        
        console.log('正在请求天地图 API...');
        console.log(`起点: ${start}`);
        console.log(`终点: ${end}`);
        console.log('');

        // 发送 HTTPS 请求
        https.get(url, (res) => {
            let data = '';

            // 接收数据
            res.on('data', (chunk) => {
                data += chunk;
            });

            // 请求完成
            res.on('end', () => {
                resolve(data);
            });

        }).on('error', (err) => {
            reject(new Error(`请求失败: ${err.message}`));
        });
    });
}

/**
 * 从 XML 中提取距离和时间
 * @param {string} xmlData - XML 格式的响应数据
 */
function parseRouteFromXML(xmlData) {
    // 提取距离（公里）
    const distanceMatch = xmlData.match(/<distance>([\d.]+)<\/distance>/);
    const distance = distanceMatch ? parseFloat(distanceMatch[1]) : null;
    
    // 提取时间（秒）
    const durationMatch = xmlData.match(/<duration>([\d.]+)<\/duration>/);
    const duration = durationMatch ? parseFloat(durationMatch[1]) : null;
    
    // 提取路线坐标
    const routelatlonMatch = xmlData.match(/<routelatlon>([^<]+)<\/routelatlon>/);
    const routelatlon = routelatlonMatch ? routelatlonMatch[1] : null;
    
    // 提取起点和终点名称
    const startNameMatch = xmlData.match(/<startname>([^<]*)<\/startname>/);
    const endNameMatch = xmlData.match(/<endname>([^<]*)<\/endname>/);
    
    return {
        distance,       // 公里
        duration,       // 秒
        routelatlon,    // 路线坐标串
        startName: startNameMatch ? startNameMatch[1] : '',
        endName: endNameMatch ? endNameMatch[1] : ''
    };
}

/**
 * 显示路线结果
 * @param {Object} route - 解析后的路线数据
 */
function displayRouteResult(route) {
    console.log('');
    console.log('✅ 路线规划成功！');
    console.log('');
    console.log('========== 路线概况 ==========');
    
    if (route.distance) {
        console.log(`📏 路线全长: ${route.distance} 公里`);
    }
    
    if (route.duration) {
        const durationMin = Math.round(route.duration / 60);
        const durationHour = (durationMin / 60).toFixed(1);
        console.log(`⏱️  预计耗时: ${durationMin} 分钟 (约 ${durationHour} 小时)`);
    }
    
    if (route.startName || route.endName) {
        console.log('');
        console.log(`🚀 起点: ${route.startName || '起点'}`);
        console.log(`🏁 终点: ${route.endName || '终点'}`);
    }
    
    // 计算平均速度
    if (route.distance && route.duration) {
        const speedKmh = ((route.distance / (route.duration / 3600))).toFixed(1);
        console.log(`� 平均速度: 约 ${speedKmh} km/h`);
    }
    
    console.log('');
    console.log('========================================');
    console.log('  API 测试成功！可以进行下一步了');
    console.log('========================================');
}

// ==================== 主程序 ====================

async function main() {
    console.log('========================================');
    console.log('  天地图驾车路径规划 API 测试');
    console.log('  固始县外卖拼单调度系统');
    console.log('========================================');
    console.log('');

    try {
        // 调用 API
        const xmlResult = await getDrivingRoute(START_POINT, END_POINT, TIANDITU_KEY);
        
        // 检查是否是错误信息
        if (xmlResult.includes('message') && xmlResult.includes('code')) {
            console.log('❌ API 返回错误');
            console.log(xmlResult);
            return;
        }
        
        // 解析 XML 数据
        const route = parseRouteFromXML(xmlResult);
        
        if (route.distance && route.duration) {
            displayRouteResult(route);
            
            // 保存结果供后续使用
            console.log('');
            console.log('💡 下一步建议：');
            console.log('   1. 进入 02-algorithm-design/ 目录');
            console.log('   2. 开始设计拼单算法（GeoHash、方向夹角、绕路率等）');
        } else {
            console.log('⚠️ 无法解析路线数据');
            console.log('原始响应：');
            console.log(xmlResult.substring(0, 500) + '...');
        }
        
    } catch (error) {
        console.log('❌ 测试失败:');
        console.log(`   ${error.message}`);
        console.log('');
        console.log('可能的解决方案:');
        console.log('   1. 检查网络连接');
        console.log('   2. 确认天地图密钥是否正确');
        console.log('   3. 检查坐标格式是否为 "经度,纬度"');
        console.log('   4. 如 API 不稳定，可考虑使用直线距离估算');
    }
}

// 运行程序
main();
