/**
 * 方向夹角计算模块
 * 用于计算两个点相对于县城中心的方向夹角
 * 
 * 方向定义（以正北为0度，顺时针增加）：
 * - 0°: 正北
 * - 90°: 正东
 * - 180°: 正南
 * - 270°: 正西
 */

// 固始县政府坐标作为县城中心参考点
const CENTER_LAT = 32.168;
const CENTER_LON = 115.654;

/**
 * 将角度转换为弧度
 * @param {number} degrees - 角度
 * @returns {number} 弧度
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * 将弧度转换为角度
 * @param {number} radians - 弧度
 * @returns {number} 角度
 */
function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * 计算从中心点到目标点的方位角（0-360度）
 * @param {number} centerLat - 中心点纬度
 * @param {number} centerLon - 中心点经度
 * @param {number} targetLat - 目标点纬度
 * @param {number} targetLon - 目标点经度
 * @returns {number} 方位角（0-360度）
 */
function calculateBearing(centerLat, centerLon, targetLat, targetLon) {
    const lat1 = toRadians(centerLat);
    const lat2 = toRadians(targetLat);
    const dLon = toRadians(targetLon - centerLon);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = toDegrees(Math.atan2(y, x));
    
    // 转换为0-360度
    bearing = (bearing + 360) % 360;
    
    return Math.round(bearing * 100) / 100; // 保留2位小数
}

/**
 * 获取方向的文字描述
 * @param {number} bearing - 方位角（0-360度）
 * @returns {string} 方向描述
 */
function getDirectionName(bearing) {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北', '北'];
    const index = Math.round(bearing / 45);
    return directions[index];
}

/**
 * 计算两个方位角之间的最小夹角
 * @param {number} bearing1 - 第一个方位角
 * @param {number} bearing2 - 第二个方位角
 * @returns {number} 最小夹角（0-180度）
 */
function calculateAngleDifference(bearing1, bearing2) {
    let diff = Math.abs(bearing1 - bearing2);
    // 取最小夹角（考虑环形）
    if (diff > 180) {
        diff = 360 - diff;
    }
    return Math.round(diff * 100) / 100;
}

/**
 * 计算两个订单相对于县城中心的方向夹角
 * @param {Object} order1 - 第一个订单 {lat, lon}
 * @param {Object} order2 - 第二个订单 {lat, lon}
 * @param {Object} center - 中心点 {lat, lon}，默认固始县政府
 * @returns {Object} 包含夹角和各自方向的对象
 */
function calculateDirectionAngle(order1, order2, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    // 计算两个订单相对于中心的方向
    const bearing1 = calculateBearing(center.lat, center.lon, order1.lat, order1.lon);
    const bearing2 = calculateBearing(center.lat, center.lon, order2.lat, order2.lon);
    
    // 计算方向夹角
    const angleDiff = calculateAngleDifference(bearing1, bearing2);
    
    return {
        bearing1,           // 订单1的方向角
        bearing2,           // 订单2的方向角
        angleDiff,          // 方向夹角
        direction1: getDirectionName(bearing1),
        direction2: getDirectionName(bearing2),
        isSameDirection: angleDiff <= 45,  // 是否同方向（夹角<=45度）
        isOppositeDirection: angleDiff >= 135  // 是否反方向（夹角>=135度）
    };
}

/**
 * 判断两个订单是否方向相近（适合拼单）
 * @param {Object} order1 - 第一个订单
 * @param {Object} order2 - 第二个订单
 * @param {number} threshold - 夹角阈值（默认45度）
 * @param {Object} center - 中心点
 * @returns {boolean} 是否方向相近
 */
function isSameDirection(order1, order2, threshold = 45, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const result = calculateDirectionAngle(order1, order2, center);
    return result.angleDiff <= threshold;
}

/**
 * 计算多个订单的方向分布（用于分析订单聚集度）
 * @param {Array} orders - 订单数组，每个元素包含 {lat, lon, id}
 * @param {Object} center - 中心点
 * @returns {Object} 方向分布统计
 */
function analyzeDirectionDistribution(orders, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const bearings = orders.map(order => ({
        id: order.id,
        bearing: calculateBearing(center.lat, center.lon, order.lat, order.lon),
        direction: getDirectionName(calculateBearing(center.lat, center.lon, order.lat, order.lon))
    }));
    
    // 按方向分组统计
    const distribution = {};
    bearings.forEach(b => {
        if (!distribution[b.direction]) {
            distribution[b.direction] = [];
        }
        distribution[b.direction].push(b);
    });
    
    return {
        total: orders.length,
        bearings,
        distribution,
        // 找出最集中的方向
        mostCrowded: Object.entries(distribution)
            .sort((a, b) => b[1].length - a[1].length)[0]
    };
}

/**
 * 计算从起点到终点的行驶方向变化
 * @param {Object} from - 起点 {lat, lon}
 * @param {Object} to - 终点 {lat, lon}
 * @returns {number} 方位角
 */
function getRouteDirection(from, to) {
    return calculateBearing(from.lat, from.lon, to.lat, to.lon);
}

module.exports = {
    calculateBearing,
    calculateAngleDifference,
    calculateDirectionAngle,
    isSameDirection,
    getDirectionName,
    analyzeDirectionDistribution,
    getRouteDirection,
    CENTER_LAT,
    CENTER_LON
};
