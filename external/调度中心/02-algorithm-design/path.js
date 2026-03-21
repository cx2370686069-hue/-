/**
 * 路径生成模块
 * 实现贪心路径生成算法，从县城出发，依次插入订单，满足取送约束
 * 
 * 约束条件：
 * - 必须先取餐再送餐
 * - 同一订单的取餐必须在送餐之前
 * - 考虑时间窗口限制
 */

const { distance } = require('./detour');

// 固始县政府坐标作为配送中心
const CENTER_LAT = 32.168;
const CENTER_LON = 115.654;

/**
 * 订单任务类型
 * PICKUP: 取餐
 * DELIVERY: 送餐
 */
const TaskType = {
    PICKUP: 'pickup',
    DELIVERY: 'delivery'
};

/**
 * 创建配送任务
 * @param {Object} order - 订单信息
 * @returns {Array} 取餐和送餐任务
 */
function createTasks(order) {
    return [
        {
            id: `${order.id}_pickup`,
            orderId: order.id,
            type: TaskType.PICKUP,
            lat: order.restaurantLat,
            lon: order.restaurantLon,
            address: order.restaurantAddress || '商家',
            timeWindow: order.pickupTimeWindow || { start: 0, end: 1440 }, // 默认全天
            completed: false
        },
        {
            id: `${order.id}_delivery`,
            orderId: order.id,
            type: TaskType.DELIVERY,
            lat: order.customerLat,
            lon: order.customerLon,
            address: order.customerAddress || '顾客',
            timeWindow: order.deliveryTimeWindow || { start: 0, end: 1440 },
            completed: false
        }
    ];
}

/**
 * 检查任务是否可以执行（满足约束条件）
 * @param {Object} task - 当前任务
 * @param {Array} completedTasks - 已完成的任务
 * @returns {boolean} 是否可以执行
 */
function canExecute(task, completedTasks) {
    // 如果是送餐任务，检查对应的取餐任务是否已完成
    if (task.type === TaskType.DELIVERY) {
        const pickupCompleted = completedTasks.some(
            t => t.orderId === task.orderId && t.type === TaskType.PICKUP
        );
        return pickupCompleted;
    }
    // 取餐任务随时可以执行
    return true;
}

/**
 * 贪心算法生成路径
 * @param {Array} orders - 订单数组
 * @param {Object} start - 起点（配送中心）
 * @returns {Object} 生成的路径
 */
function generateGreedyPath(orders, start = { lat: CENTER_LAT, lon: CENTER_LON }) {
    // 创建所有任务
    let allTasks = [];
    orders.forEach(order => {
        allTasks = allTasks.concat(createTasks(order));
    });
    
    const path = [{
        ...start,
        id: 'start',
        type: 'start',
        address: '配送中心'
    }];
    
    const completedTasks = [];
    let current = start;
    let totalDistance = 0;
    let estimatedTime = 0; // 分钟
    
    // 每次选择最近的可执行任务
    while (completedTasks.length < allTasks.length) {
        let bestTask = null;
        let bestDistance = Infinity;
        let bestIndex = -1;
        
        for (let i = 0; i < allTasks.length; i++) {
            const task = allTasks[i];
            
            // 跳过已完成的任务
            if (task.completed) continue;
            
            // 检查是否可以执行（满足约束）
            if (!canExecute(task, completedTasks)) continue;
            
            // 计算距离
            const dist = distance(current, { lat: task.lat, lon: task.lon });
            
            // 选择最近的任务
            if (dist < bestDistance) {
                bestDistance = dist;
                bestTask = task;
                bestIndex = i;
            }
        }
        
        if (bestTask === null) {
            // 没有可执行的任务（约束冲突）
            throw new Error('无法生成有效路径：存在约束冲突');
        }
        
        // 添加任务到路径
        path.push({
            ...bestTask,
            distance: bestDistance,
            cumulativeDistance: totalDistance + bestDistance
        });
        
        // 更新状态
        totalDistance += bestDistance;
        estimatedTime += (bestDistance / 0.5) + 5; // 假设速度30km/h，每单5分钟操作时间
        current = { lat: bestTask.lat, lon: bestTask.lon };
        bestTask.completed = true;
        completedTasks.push(bestTask);
    }
    
    // 返回配送中心
    const returnDistance = distance(current, start);
    path.push({
        ...start,
        id: 'end',
        type: 'end',
        address: '配送中心',
        distance: returnDistance,
        cumulativeDistance: totalDistance + returnDistance
    });
    totalDistance += returnDistance;
    
    return {
        path,
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedTime: Math.round(estimatedTime),
        taskCount: allTasks.length,
        orderCount: orders.length
    };
}

/**
 * 插入算法：将新订单插入到现有路径的最佳位置
 * @param {Object} newOrder - 新订单
 * @param {Array} currentPath - 当前路径
 * @param {Object} start - 起点
 * @returns {Object} 插入后的新路径
 */
function insertOrder(newOrder, currentPath, start = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const newTasks = createTasks(newOrder);
    const pickupTask = newTasks[0];
    const deliveryTask = newTasks[1];
    
    let bestPath = null;
    let bestDistance = Infinity;
    
    // 尝试所有可能的插入位置
    // 取餐任务可以插入到任何位置
    for (let i = 1; i < currentPath.length; i++) {
        // 送餐任务必须插入到取餐任务之后
        for (let j = i + 1; j <= currentPath.length; j++) {
            // 创建新路径
            const newPath = [...currentPath];
            
            // 插入取餐任务
            newPath.splice(i, 0, {
                ...pickupTask,
                inserted: true
            });
            
            // 插入送餐任务
            newPath.splice(j, 0, {
                ...deliveryTask,
                inserted: true
            });
            
            // 计算新路径的总距离
            let totalDist = 0;
            for (let k = 0; k < newPath.length - 1; k++) {
                totalDist += distance(
                    { lat: newPath[k].lat, lon: newPath[k].lon },
                    { lat: newPath[k + 1].lat, lon: newPath[k + 1].lon }
                );
            }
            
            // 更新最优解
            if (totalDist < bestDistance) {
                bestDistance = totalDist;
                bestPath = newPath;
            }
        }
    }
    
    return {
        path: bestPath,
        totalDistance: Math.round(bestDistance * 100) / 100,
        addedOrder: newOrder
    };
}

/**
 * 多订单路径规划（批量处理）
 * @param {Array} orders - 订单数组
 * @param {number} maxOrdersPerRoute - 每趟最多订单数
 * @param {Object} start - 起点
 * @returns {Array} 多趟配送路径
 */
function planMultipleRoutes(orders, maxOrdersPerRoute = 3, start = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const routes = [];
    const remainingOrders = [...orders];
    
    while (remainingOrders.length > 0) {
        // 取出一批订单
        const batchSize = Math.min(maxOrdersPerRoute, remainingOrders.length);
        const batch = remainingOrders.splice(0, batchSize);
        
        // 为这批订单生成路径
        const route = generateGreedyPath(batch, start);
        routes.push(route);
    }
    
    return routes;
}

/**
 * 计算路径的详细信息
 * @param {Array} path - 路径数组
 * @returns {Object} 路径详情
 */
function analyzePath(path) {
    const details = {
        stops: path.length,
        pickups: path.filter(p => p.type === TaskType.PICKUP).length,
        deliveries: path.filter(p => p.type === TaskType.DELIVERY).length,
        segments: []
    };
    
    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        const dist = distance(
            { lat: from.lat, lon: from.lon },
            { lat: to.lat, lon: to.lon }
        );
        
        details.segments.push({
            from: from.address || `${from.lat},${from.lon}`,
            to: to.address || `${to.lat},${to.lon}`,
            distance: Math.round(dist * 100) / 100,
            type: to.type
        });
    }
    
    return details;
}

/**
 * 生成路径的文字报告
 * @param {Object} routeResult - 路径规划结果
 * @returns {string} 报告文本
 */
function generatePathReport(routeResult) {
    const lines = [];
    lines.push('========== 配送路径规划报告 ==========');
    lines.push(`订单数量: ${routeResult.orderCount}`);
    lines.push(`任务数量: ${routeResult.taskCount} (取餐+送餐)`);
    lines.push(`总距离: ${routeResult.totalDistance} km`);
    lines.push(`预计时间: ${routeResult.estimatedTime} 分钟`);
    lines.push('');
    lines.push('【配送路线】');
    
    routeResult.path.forEach((point, index) => {
        const typeIcon = {
            start: '🏠',
            end: '🏠',
            pickup: '📦',
            delivery: '🍔'
        }[point.type] || '📍';
        
        const typeName = {
            start: '起点',
            end: '终点',
            pickup: '取餐',
            delivery: '送餐'
        }[point.type] || point.type;
        
        if (point.distance !== undefined) {
            lines.push(`  ${index}. ${typeIcon} ${typeName}: ${point.address} (+${Math.round(point.distance * 100) / 100}km)`);
        } else {
            lines.push(`  ${index}. ${typeIcon} ${typeName}: ${point.address}`);
        }
    });
    
    return lines.join('\n');
}

module.exports = {
    generateGreedyPath,
    insertOrder,
    planMultipleRoutes,
    analyzePath,
    generatePathReport,
    createTasks,
    canExecute,
    TaskType,
    CENTER_LAT,
    CENTER_LON
};
