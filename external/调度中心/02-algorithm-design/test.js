/**
 * 综合测试模块
 * 测试所有算法模块的功能
 */

const geohash = require('./geohash');
const direction = require('./direction');
const detour = require('./detour');
const matching = require('./matching');
const path = require('./path');
const optimizer = require('./optimizer');

// ==================== 测试数据 ====================

// 固始县中心点（配送站）
const CENTER = { lat: 32.168, lon: 115.654 };

// 模拟乡镇坐标（固始县周边）
const LOCATIONS = {
    center: CENTER,
    // 北部乡镇
    wangdian: { lat: 32.245, lon: 115.612, name: '汪店镇' },
    // 东部乡镇
    sandaohe: { lat: 32.189, lon: 115.789, name: '三道河' },
    // 南部乡镇
    duanji: { lat: 32.058, lon: 115.712, name: '段集镇' },
    // 西部乡镇
    wangji: { lat: 32.142, lon: 115.523, name: '汪集镇' },
    // 东北部
    liuji: { lat: 32.201, lon: 115.734, name: '刘集镇' },
    // 东南部
    wanglou: { lat: 32.089, lon: 115.768, name: '汪楼镇' }
};

// 模拟订单数据
const MOCK_ORDERS = [
    {
        id: 'O001',
        restaurantLat: 32.175,
        restaurantLon: 115.660,
        restaurantAddress: '肯德基（固始店）',
        customerLat: LOCATIONS.wangdian.lat,
        customerLon: LOCATIONS.wangdian.lon,
        customerAddress: LOCATIONS.wangdian.name,
        pickupTimeWindow: { start: 0, end: 30 },
        deliveryTimeWindow: { start: 20, end: 60 }
    },
    {
        id: 'O002',
        restaurantLat: 32.165,
        restaurantLon: 115.648,
        restaurantAddress: '麦当劳（固始店）',
        customerLat: LOCATIONS.duanji.lat,
        customerLon: LOCATIONS.duanji.lon,
        customerAddress: LOCATIONS.duanji.name,
        pickupTimeWindow: { start: 0, end: 30 },
        deliveryTimeWindow: { start: 20, end: 60 }
    },
    {
        id: 'O003',
        restaurantLat: 32.170,
        restaurantLon: 115.655,
        restaurantAddress: '必胜客（固始店）',
        customerLat: LOCATIONS.sandaohe.lat,
        customerLon: LOCATIONS.sandaohe.lon,
        customerAddress: LOCATIONS.sandaohe.name,
        pickupTimeWindow: { start: 0, end: 30 },
        deliveryTimeWindow: { start: 20, end: 60 }
    },
    {
        id: 'O004',
        restaurantLat: 32.168,
        restaurantLon: 115.654,
        restaurantAddress: '老乡鸡（固始店）',
        customerLat: LOCATIONS.wangji.lat,
        customerLon: LOCATIONS.wangji.lon,
        customerAddress: LOCATIONS.wangji.name,
        pickupTimeWindow: { start: 0, end: 30 },
        deliveryTimeWindow: { start: 20, end: 60 }
    }
];

// ==================== 测试函数 ====================

function testGeoHash() {
    console.log('\n========================================');
    console.log('  测试 1: GeoHash 编码/解码');
    console.log('========================================\n');

    // 测试编码
    console.log('【编码测试】');
    Object.entries(LOCATIONS).forEach(([key, loc]) => {
        const hash5 = geohash.encode(loc.lat, loc.lon, 5);
        const hash6 = geohash.encode(loc.lat, loc.lon, 6);
        console.log(`${loc.name || key}: ${hash5} (精度5), ${hash6} (精度6)`);
    });

    // 测试解码
    console.log('\n【解码测试】');
    const testHash = geohash.encode(CENTER.lat, CENTER.lon, 6);
    const decoded = geohash.decode(testHash);
    console.log(`编码: ${testHash}`);
    console.log(`解码: lat=${decoded.lat}, lon=${decoded.lon}`);
    console.log(`误差: lat±${decoded.latError}km, lon±${decoded.lonError}km`);

    // 测试相邻格子
    console.log('\n【相邻格子测试】');
    const neighbors = geohash.getNeighbors(testHash);
    console.log(`中心: ${testHash}`);
    console.log(`北: ${neighbors.north}, 南: ${neighbors.south}`);
    console.log(`东: ${neighbors.east}, 西: ${neighbors.west}`);

    // 测试精度大小
    console.log('\n【精度大小】');
    for (let p = 4; p <= 7; p++) {
        const size = geohash.getPrecisionSize(p);
        console.log(`精度${p}: ${size.width}km x ${size.height}km`);
    }
}

function testDirection() {
    console.log('\n========================================');
    console.log('  测试 2: 方向夹角计算');
    console.log('========================================\n');

    // 测试方位角计算
    console.log('【方位角测试】');
    Object.entries(LOCATIONS).forEach(([key, loc]) => {
        if (key === 'center') return;
        const bearing = direction.calculateBearing(CENTER.lat, CENTER.lon, loc.lat, loc.lon);
        const dirName = direction.getDirectionName(bearing);
        console.log(`${loc.name}: ${bearing}° (${dirName})`);
    });

    // 测试方向夹角
    console.log('\n【方向夹角测试】');
    const pairs = [
        [LOCATIONS.wangdian, LOCATIONS.liuji, '汪店-刘集'],
        [LOCATIONS.wangdian, LOCATIONS.duanji, '汪店-段集'],
        [LOCATIONS.sandaohe, LOCATIONS.wanglou, '三道河-汪楼'],
        [LOCATIONS.wangdian, LOCATIONS.wangji, '汪店-汪集']
    ];

    pairs.forEach(([loc1, loc2, name]) => {
        const result = direction.calculateDirectionAngle(loc1, loc2, CENTER);
        console.log(`${name}:`);
        console.log(`  方向1: ${result.bearing1}° (${result.direction1})`);
        console.log(`  方向2: ${result.bearing2}° (${result.direction2})`);
        console.log(`  夹角: ${result.angleDiff}°`);
        console.log(`  同方向: ${result.isSameDirection ? '是' : '否'}`);
    });
}

function testDetour() {
    console.log('\n========================================');
    console.log('  测试 3: 绕路率计算');
    console.log('========================================\n');

    // 测试两点距离
    console.log('【距离计算】');
    const dist1 = detour.distance(CENTER, LOCATIONS.duanji);
    const dist2 = detour.distance(CENTER, LOCATIONS.wangdian);
    console.log(`中心到段集: ${dist1.toFixed(2)}km`);
    console.log(`中心到汪店: ${dist2.toFixed(2)}km`);

    // 测试绕路率
    console.log('\n【绕路率测试】');
    const detourResult = detour.calculateDetourRate(CENTER, LOCATIONS.duanji, LOCATIONS.wangdian);
    console.log('段集 + 汪店 拼单:');
    console.log(`  单独配送: ${detourResult.totalSingle}km`);
    console.log(`  拼单配送: ${detourResult.combinedRoute}km`);
    console.log(`  绕路率: ${detourResult.detourRate}%`);
    console.log(`  是否高效: ${detourResult.isEfficient ? '是' : '否'}`);
    console.log(`  节省: ${detourResult.savings}km`);

    // 测试是否可以拼单
    console.log('\n【拼单判断】');
    const batchDecision = detour.canBatch(detourResult.detourRate);
    console.log(`绕路率 ${detourResult.detourRate}%: ${batchDecision.description}`);

    // 测试多订单绕路
    console.log('\n【多订单绕路测试】');
    const multiResult = detour.calculateMultiDetour(CENTER, [
        LOCATIONS.duanji,
        LOCATIONS.wangdian,
        LOCATIONS.sandaohe
    ]);
    console.log(`3个订单拼单:`);
    console.log(`  总距离: ${multiResult.distance}km`);
    console.log(`  单独总和: ${multiResult.totalSingle}km`);
    console.log(`  绕路率: ${multiResult.detourRate}%`);
}

function testMatching() {
    console.log('\n========================================');
    console.log('  测试 4: 综合顺路度匹配');
    console.log('========================================\n');

    // 测试综合评分
    console.log('【综合评分测试】');
    const pairs = [
        [LOCATIONS.wangdian, LOCATIONS.liuji, '汪店-刘集（同方向）'],
        [LOCATIONS.duanji, LOCATIONS.wanglou, '段集-汪楼（同方向）'],
        [LOCATIONS.wangdian, LOCATIONS.duanji, '汪店-段集（反方向）'],
        [LOCATIONS.wangji, LOCATIONS.sandaohe, '汪集-三道河（垂直）']
    ];

    pairs.forEach(([loc1, loc2, name]) => {
        console.log(`\n${name}:`);
        const result = matching.calculateMatchingScore(loc1, loc2, CENTER);
        console.log(`  综合评分: ${result.score}/100`);
        console.log(`  建议: ${result.recommendation}`);
        console.log(`  方向得分: ${result.details.direction.score}/40`);
        console.log(`  绕路得分: ${result.details.detour.score}/40`);
        console.log(`  距离得分: ${result.details.distance.score}/20`);
    });

    // 测试最佳匹配
    console.log('\n【最佳匹配测试】');
    const target = LOCATIONS.duanji;
    const candidates = [LOCATIONS.wangdian, LOCATIONS.sandaohe, LOCATIONS.wanglou];
    const bestMatch = matching.findBestMatch(target, candidates, CENTER);
    
    if (bestMatch.found) {
        console.log(`为 ${target.name} 找到最佳拼单伙伴:`);
        console.log(`  ${bestMatch.bestMatch.order.name} (评分: ${bestMatch.bestMatch.score})`);
    }

    // 测试分组
    console.log('\n【订单分组测试】');
    const allLocations = Object.values(LOCATIONS).filter(l => l.name);
    const groups = matching.groupOrders(allLocations, CENTER);
    console.log(`将 ${allLocations.length} 个地点分成 ${groups.length} 组:`);
    groups.forEach((group, i) => {
        const names = group.orders.map(o => o.name).join(', ');
        console.log(`  组${i + 1} (${group.count}个): ${names}`);
    });
}

function testPath() {
    console.log('\n========================================');
    console.log('  测试 5: 路径规划');
    console.log('========================================\n');

    // 测试单订单路径
    console.log('【单订单路径】');
    const singleOrder = [MOCK_ORDERS[0]];
    const singlePath = path.generateGreedyPath(singleOrder, CENTER);
    console.log(path.generatePathReport(singlePath));

    // 测试多订单路径
    console.log('\n【多订单路径（2单拼单）】');
    const twoOrders = [MOCK_ORDERS[0], MOCK_ORDERS[1]];
    const twoPath = path.generateGreedyPath(twoOrders, CENTER);
    console.log(path.generatePathReport(twoPath));

    // 测试3单拼单
    console.log('\n【多订单路径（3单拼单）】');
    const threeOrders = [MOCK_ORDERS[0], MOCK_ORDERS[1], MOCK_ORDERS[2]];
    const threePath = path.generateGreedyPath(threeOrders, CENTER);
    console.log(path.generatePathReport(threePath));

    // 测试多趟配送
    console.log('\n【多趟配送规划】');
    const routes = path.planMultipleRoutes(MOCK_ORDERS, 2, CENTER);
    console.log(`将 ${MOCK_ORDERS.length} 个订单分成 ${routes.length} 趟配送:`);
    routes.forEach((route, i) => {
        console.log(`\n第 ${i + 1} 趟:`);
        console.log(`  订单数: ${route.orderCount}`);
        console.log(`  总距离: ${route.totalDistance}km`);
        console.log(`  预计时间: ${route.estimatedTime}分钟`);
    });
}

function testOptimizer() {
    console.log('\n========================================');
    console.log('  测试 6: 路径优化');
    console.log('========================================\n');

    // 测试2-opt优化
    console.log('【2-opt 优化测试】');
    const twoOrders = [MOCK_ORDERS[0], MOCK_ORDERS[1]];
    const initialPath = path.generateGreedyPath(twoOrders, CENTER);
    console.log(`初始路径距离: ${initialPath.totalDistance}km`);
    
    const optimized = optimizer.optimize2Opt(initialPath.path);
    console.log(`优化后距离: ${optimized.distance}km`);
    console.log(`改进: ${optimized.improved ? '是' : '否'}`);
    console.log(`迭代次数: ${optimized.iterations}`);

    // 测试综合优化
    console.log('\n【综合优化测试（3单）】');
    const threeOrders = [MOCK_ORDERS[0], MOCK_ORDERS[1], MOCK_ORDERS[2]];
    const fullOptimized = optimizer.optimizeRoute(threeOrders, CENTER);
    console.log(optimizer.generateOptimizationReport(fullOptimized));
}

function testIntegration() {
    console.log('\n========================================');
    console.log('  测试 7: 综合场景测试');
    console.log('========================================\n');

    console.log('【场景：外卖高峰期订单分配】\n');

    // 模拟高峰期订单
    const rushHourOrders = MOCK_ORDERS.map(order => ({
        ...order,
        priority: Math.floor(Math.random() * 3) + 1 // 1-3优先级
    }));

    console.log(`收到 ${rushHourOrders.length} 个订单\n`);

    // 步骤1: GeoHash分组（按地理位置）
    console.log('步骤1: GeoHash空间分组');
    const ordersWithGeoHash = rushHourOrders.map(order => ({
        ...order,
        geohash: geohash.encode(order.customerLat, order.customerLon, 5)
    }));
    
    const geoGroups = {};
    ordersWithGeoHash.forEach(order => {
        if (!geoGroups[order.geohash]) {
            geoGroups[order.geohash] = [];
        }
        geoGroups[order.geohash].push(order);
    });
    console.log(`按GeoHash分成 ${Object.keys(geoGroups).length} 个区域\n`);

    // 步骤2: 在每个区域内进行匹配
    console.log('步骤2: 区域内订单匹配');
    const allGroups = [];
    Object.entries(geoGroups).forEach(([hash, orders]) => {
        if (orders.length >= 2) {
            const groups = matching.groupOrders(
                orders.map(o => ({ lat: o.customerLat, lon: o.customerLon, id: o.id })),
                CENTER
            );
            allGroups.push(...groups);
        } else {
            allGroups.push({ orders: orders.map(o => ({ lat: o.customerLat, lon: o.customerLon, id: o.id })), count: 1, isBatch: false });
        }
    });

    console.log(`形成 ${allGroups.length} 个配送组:`);
    allGroups.forEach((group, i) => {
        const ids = group.orders.map(o => o.id).join(', ');
        console.log(`  组${i + 1}: ${ids} (${group.isBatch ? '拼单' : '单独'})`);
    });

    // 步骤3: 路径规划
    console.log('\n步骤3: 生成配送路径');
    allGroups.forEach((group, i) => {
        if (group.orders.length > 0) {
            const groupOrders = rushHourOrders.filter(o => 
                group.orders.some(go => go.id === o.id)
            );
            const route = path.generateGreedyPath(groupOrders, CENTER);
            console.log(`\n第 ${i + 1} 组配送:`);
            console.log(`  距离: ${route.totalDistance}km`);
            console.log(`  时间: ${route.estimatedTime}分钟`);
        }
    });

    // 步骤4: 统计
    console.log('\n步骤4: 配送统计');
    const totalOrders = rushHourOrders.length;
    const batchGroups = allGroups.filter(g => g.isBatch).length;
    const singleGroups = allGroups.filter(g => !g.isBatch).length;
    console.log(`总订单: ${totalOrders}`);
    console.log(`拼单组: ${batchGroups}`);
    console.log(`单送组: ${singleGroups}`);
    console.log(`拼单率: ${Math.round((totalOrders - singleGroups) / totalOrders * 100)}%`);
}

// ==================== 主程序 ====================

function runAllTests() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║                                                ║');
    console.log('║     固始县外卖拼单调度算法测试                 ║');
    console.log('║                                                ║');
    console.log('╚════════════════════════════════════════════════╝');

    try {
        testGeoHash();
        testDirection();
        testDetour();
        testMatching();
        testPath();
        testOptimizer();
        testIntegration();

        console.log('\n========================================');
        console.log('  所有测试完成！');
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ 测试出错:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
runAllTests();
