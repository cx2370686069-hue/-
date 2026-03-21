/**
 * 绕路率计算模块
 * 用于计算拼单配送相比单独配送多走的路程比例
 * 
 * 绕路率 = (拼单总路程 - 单独配送路程之和) / 单独配送路程之和 * 100%
 */

/**
 * 使用 Haversine 公式计算两点间的直线距离（单位：公里）
 * @param {number} lat1 - 点1纬度
 * @param {number} lon1 - 点1经度
 * @param {number} lat2 - 点2纬度
 * @param {number} lon2 - 点2经度
 * @returns {number} 距离（公里）
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

/**
 * 计算两点间的直线距离（简化接口）
 * @param {Object} point1 - 点1 {lat, lon}
 * @param {Object} point2 - 点2 {lat, lon}
 * @returns {number} 距离（公里）
 */
function distance(point1, point2) {
    return haversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
}

/**
 * 计算多个点的总路程（按顺序经过所有点）
 * @param {Array} points - 点数组 [{lat, lon}, ...]
 * @returns {number} 总路程（公里）
 */
function totalDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += distance(points[i], points[i + 1]);
    }
    return total;
}

/**
 * 计算绕路率
 * @param {Object} start - 起点（县城中心/配送站）{lat, lon}
 * @param {Object} dest1 - 第一个终点 {lat, lon}
 * @param {Object} dest2 - 第二个终点 {lat, lon}
 * @param {string} routeType - 路线类型：'A-B' 或 'A-C-B' 或 'B-A-C'
 * @returns {Object} 绕路率计算结果
 */
function calculateDetourRate(start, dest1, dest2, routeType = 'optimal') {
    // 单独配送的路程
    const singleRoute1 = distance(start, dest1);  // 只送订单1
    const singleRoute2 = distance(start, dest2);  // 只送订单2
    const totalSingle = singleRoute1 + singleRoute2;
    
    // 可能的拼单路线
    const routes = {
        // 路线1: 起点 -> 终点1 -> 终点2
        '1-2': {
            path: [start, dest1, dest2],
            distance: distance(start, dest1) + distance(dest1, dest2)
        },
        // 路线2: 起点 -> 终点2 -> 终点1
        '2-1': {
            path: [start, dest2, dest1],
            distance: distance(start, dest2) + distance(dest1, dest2)
        }
    };
    
    // 选择最优拼单路线
    let bestRoute;
    if (routeType === 'optimal') {
        bestRoute = routes['1-2'].distance <= routes['2-1'].distance ? routes['1-2'] : routes['2-1'];
    } else {
        bestRoute = routes[routeType] || routes['1-2'];
    }
    
    // 计算绕路率
    const detourDistance = bestRoute.distance - totalSingle;
    const detourRate = (detourDistance / totalSingle) * 100;
    
    return {
        singleRoute1: Math.round(singleRoute1 * 100) / 100,      // 单独送订单1的距离
        singleRoute2: Math.round(singleRoute2 * 100) / 100,      // 单独送订单2的距离
        totalSingle: Math.round(totalSingle * 100) / 100,        // 单独配送总距离
        combinedRoute: Math.round(bestRoute.distance * 100) / 100, // 拼单配送距离
        detourDistance: Math.round(detourDistance * 100) / 100,  // 多走的距离
        detourRate: Math.round(detourRate * 100) / 100,          // 绕路率（%）
        route: bestRoute.path,                                   // 最优路线
        isEfficient: detourRate <= 30,                           // 是否高效（绕路率<=30%）
        savings: Math.round((totalSingle - bestRoute.distance) * 100) / 100  // 节省的距离
    };
}

/**
 * 计算多个订单的最优配送顺序（简化版TSP）
 * @param {Object} start - 起点
 * @param {Array} destinations - 终点数组 [{lat, lon, id}, ...]
 * @returns {Object} 最优路线和绕路率
 */
function calculateMultiDetour(start, destinations) {
    if (destinations.length === 0) {
        return { distance: 0, route: [start] };
    }
    
    if (destinations.length === 1) {
        const dist = distance(start, destinations[0]);
        return {
            distance: dist,
            route: [start, destinations[0]],
            detourRate: 0
        };
    }
    
    // 贪心算法：每次选择最近的未访问点
    const unvisited = [...destinations];
    const route = [start];
    let current = start;
    let totalDist = 0;
    
    while (unvisited.length > 0) {
        // 找到最近的未访问点
        let nearestIndex = 0;
        let nearestDist = Infinity;
        
        for (let i = 0; i < unvisited.length; i++) {
            const dist = distance(current, unvisited[i]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }
        
        // 添加到路线
        const next = unvisited.splice(nearestIndex, 1)[0];
        route.push(next);
        totalDist += nearestDist;
        current = next;
    }
    
    // 计算单独配送的总距离作为基准
    let totalSingle = 0;
    for (const dest of destinations) {
        totalSingle += distance(start, dest);
    }
    
    const detourRate = ((totalDist - totalSingle) / totalSingle) * 100;
    
    return {
        distance: Math.round(totalDist * 100) / 100,
        totalSingle: Math.round(totalSingle * 100) / 100,
        detourRate: Math.round(detourRate * 100) / 100,
        route: route,
        isEfficient: detourRate <= 50
    };
}

/**
 * 根据绕路率判断是否可以拼单
 * @param {number} detourRate - 绕路率（%）
 * @param {Object} thresholds - 阈值配置
 * @returns {Object} 判断结果
 */
function canBatch(detourRate, thresholds = { excellent: 20, good: 40, acceptable: 60 }) {
    let level = 'unacceptable';
    let canBatch = false;
    
    if (detourRate <= thresholds.excellent) {
        level = 'excellent';
        canBatch = true;
    } else if (detourRate <= thresholds.good) {
        level = 'good';
        canBatch = true;
    } else if (detourRate <= thresholds.acceptable) {
        level = 'acceptable';
        canBatch = true;
    }
    
    return {
        canBatch,
        level,
        detourRate,
        description: getDetourDescription(level)
    };
}

/**
 * 获取绕路率的文字描述
 * @param {string} level - 等级
 * @returns {string} 描述
 */
function getDetourDescription(level) {
    const descriptions = {
        excellent: '非常顺路，强烈推荐拼单',
        good: '比较顺路，建议拼单',
        acceptable: '勉强可以接受，谨慎拼单',
        unacceptable: '绕路太多，不建议拼单'
    };
    return descriptions[level] || '未知';
}

module.exports = {
    haversineDistance,
    distance,
    totalDistance,
    calculateDetourRate,
    calculateMultiDetour,
    canBatch,
    getDetourDescription
};
