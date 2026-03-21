/**
 * 路径优化模块
 * 实现 2-opt 路径优化算法，用于改进贪心算法生成的路径
 * 
 * 2-opt 算法原理：
 * - 随机选择路径中的两条边，反转它们之间的路径段
 * - 如果新路径更短，则接受这个改变
 * - 重复直到无法改进
 * 
 * 约束保持：
 * - 保持取餐在送餐之前的顺序
 * - 同一订单的取餐和送餐相对顺序不变
 */

const { distance } = require('./detour');
const { canExecute, TaskType } = require('./path');

/**
 * 计算路径总距离
 * @param {Array} path - 路径点数组
 * @returns {number} 总距离
 */
function calculateTotalDistance(path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        total += distance(
            { lat: path[i].lat, lon: path[i].lon },
            { lat: path[i + 1].lat, lon: path[i + 1].lon }
        );
    }
    return total;
}

/**
 * 检查路径是否满足约束条件
 * @param {Array} path - 路径数组
 * @returns {boolean} 是否满足约束
 */
function isValidPath(path) {
    const completedTasks = [];
    
    for (const point of path) {
        if (point.type === TaskType.PICKUP || point.type === TaskType.DELIVERY) {
            if (!canExecute(point, completedTasks)) {
                return false;
            }
            completedTasks.push(point);
        }
    }
    
    return true;
}

/**
 * 执行 2-opt 交换
 * 反转路径中从 i 到 j 的段
 * @param {Array} path - 原路径
 * @param {number} i - 起始索引
 * @param {number} j - 结束索引
 * @returns {Array} 新路径
 */
function twoOptSwap(path, i, j) {
    const newPath = [...path];
    
    // 反转 i 到 j 之间的段
    while (i < j) {
        [newPath[i], newPath[j]] = [newPath[j], newPath[i]];
        i++;
        j--;
    }
    
    return newPath;
}

/**
 * 2-opt 路径优化算法
 * @param {Array} initialPath - 初始路径
 * @param {number} maxIterations - 最大迭代次数
 * @returns {Object} 优化后的路径
 */
function optimize2Opt(initialPath, maxIterations = 1000) {
    let bestPath = [...initialPath];
    let bestDistance = calculateTotalDistance(bestPath);
    let improved = true;
    let iterations = 0;
    
    // 只优化中间的任务点（保持起点和终点不变）
    const startIdx = 1;
    const endIdx = bestPath.length - 2;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = startIdx; i <= endIdx; i++) {
            for (let j = i + 1; j <= endIdx; j++) {
                // 执行 2-opt 交换
                const newPath = twoOptSwap(bestPath, i, j);
                
                // 检查约束
                if (!isValidPath(newPath)) {
                    continue;
                }
                
                // 计算新距离
                const newDistance = calculateTotalDistance(newPath);
                
                // 如果更优，接受
                if (newDistance < bestDistance - 0.001) { // 0.001km = 1m 的容差
                    bestPath = newPath;
                    bestDistance = newDistance;
                    improved = true;
                }
            }
        }
    }
    
    return {
        path: bestPath,
        distance: Math.round(bestDistance * 100) / 100,
        iterations,
        improved: bestDistance < calculateTotalDistance(initialPath) - 0.001
    };
}

/**
 * 3-opt 优化（更高级，可选）
 * 尝试移除三条边并重新连接
 * @param {Array} initialPath - 初始路径
 * @param {number} maxIterations - 最大迭代次数
 * @returns {Object} 优化后的路径
 */
function optimize3Opt(initialPath, maxIterations = 500) {
    let bestPath = [...initialPath];
    let bestDistance = calculateTotalDistance(bestPath);
    let improved = true;
    let iterations = 0;
    
    const startIdx = 1;
    const endIdx = bestPath.length - 2;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        for (let i = startIdx; i <= endIdx - 1; i++) {
            for (let j = i + 1; j <= endIdx; j++) {
                for (let k = j + 1; k <= endIdx + 1; k++) {
                    // 尝试不同的重连方式
                    const candidates = generate3OptCandidates(bestPath, i, j, k);
                    
                    for (const candidate of candidates) {
                        if (!isValidPath(candidate)) continue;
                        
                        const candidateDistance = calculateTotalDistance(candidate);
                        if (candidateDistance < bestDistance - 0.001) {
                            bestPath = candidate;
                            bestDistance = candidateDistance;
                            improved = true;
                        }
                    }
                }
            }
        }
    }
    
    return {
        path: bestPath,
        distance: Math.round(bestDistance * 100) / 100,
        iterations,
        improved: bestDistance < calculateTotalDistance(initialPath) - 0.001
    };
}

/**
 * 生成 3-opt 的候选路径
 * @param {Array} path - 原路径
 * @param {number} i - 第一个断点
 * @param {number} j - 第二个断点
 * @param {number} k - 第三个断点
 * @returns {Array} 候选路径数组
 */
function generate3OptCandidates(path, i, j, k) {
    const candidates = [];
    
    // 将路径分成四段
    const segment1 = path.slice(0, i);
    const segment2 = path.slice(i, j);
    const segment3 = path.slice(j, k);
    const segment4 = path.slice(k);
    
    // 方式1: 不反转任何段
    candidates.push([...segment1, ...segment2, ...segment3, ...segment4]);
    
    // 方式2: 反转 segment2
    candidates.push([...segment1, ...segment2.reverse(), ...segment3, ...segment4]);
    
    // 方式3: 反转 segment3
    candidates.push([...segment1, ...segment2, ...segment3.reverse(), ...segment4]);
    
    // 方式4: 反转 segment2 和 segment3
    candidates.push([...segment1, ...segment2.reverse(), ...segment3.reverse(), ...segment4]);
    
    // 方式5-7: 交换 segment2 和 segment3 的位置
    candidates.push([...segment1, ...segment3, ...segment2, ...segment4]);
    candidates.push([...segment1, ...segment3.reverse(), ...segment2, ...segment4]);
    candidates.push([...segment1, ...segment3, ...segment2.reverse(), ...segment4]);
    
    return candidates;
}

/**
 * 综合优化：先使用贪心算法，再应用 2-opt 和 3-opt
 * @param {Array} orders - 订单数组
 * @param {Object} start - 起点
 * @returns {Object} 优化后的完整结果
 */
function optimizeRoute(orders, start) {
    const { generateGreedyPath } = require('./path');
    
    // 1. 使用贪心算法生成初始路径
    console.log('  步骤1: 生成贪心路径...');
    const greedyResult = generateGreedyPath(orders, start);
    const initialDistance = greedyResult.totalDistance;
    
    // 2. 应用 2-opt 优化
    console.log('  步骤2: 应用 2-opt 优化...');
    const opt2Result = optimize2Opt(greedyResult.path);
    
    // 3. 应用 3-opt 优化（可选，如果2-opt有改进）
    let opt3Result = null;
    if (opt2Result.improved) {
        console.log('  步骤3: 应用 3-opt 优化...');
        opt3Result = optimize3Opt(opt2Result.path);
    }
    
    // 选择最优结果
    const finalResult = opt3Result && opt3Result.distance < opt2Result.distance 
        ? opt3Result 
        : opt2Result;
    
    const improvement = initialDistance - finalResult.distance;
    const improvementPercent = (improvement / initialDistance * 100).toFixed(2);
    
    return {
        path: finalResult.path,
        initialDistance: Math.round(initialDistance * 100) / 100,
        optimizedDistance: finalResult.distance,
        improvement: Math.round(improvement * 100) / 100,
        improvementPercent: parseFloat(improvementPercent),
        iterations2Opt: opt2Result.iterations,
        iterations3Opt: opt3Result ? opt3Result.iterations : 0,
        orderCount: orders.length
    };
}

/**
 * 批量优化多趟配送路线
 * @param {Array} routes - 路线数组
 * @returns {Array} 优化后的路线数组
 */
function optimizeMultipleRoutes(routes) {
    return routes.map((route, index) => {
        console.log(`\n优化第 ${index + 1} 条路线...`);
        
        const optimized = optimize2Opt(route.path);
        
        return {
            ...route,
            path: optimized.path,
            totalDistance: optimized.distance,
            optimized: optimized.improved,
            iterations: optimized.iterations
        };
    });
}

/**
 * 生成优化报告
 * @param {Object} result - 优化结果
 * @returns {string} 报告文本
 */
function generateOptimizationReport(result) {
    const lines = [];
    lines.push('========== 路径优化报告 ==========');
    lines.push(`订单数量: ${result.orderCount}`);
    lines.push('');
    lines.push('【优化结果】');
    lines.push(`初始距离: ${result.initialDistance} km`);
    lines.push(`优化后距离: ${result.optimizedDistance} km`);
    lines.push(`节省距离: ${result.improvement} km (${result.improvementPercent}%)`);
    lines.push('');
    lines.push('【迭代信息】');
    lines.push(`2-opt 迭代次数: ${result.iterations2Opt}`);
    if (result.iterations3Opt > 0) {
        lines.push(`3-opt 迭代次数: ${result.iterations3Opt}`);
    }
    
    return lines.join('\n');
}

module.exports = {
    optimize2Opt,
    optimize3Opt,
    optimizeRoute,
    optimizeMultipleRoutes,
    calculateTotalDistance,
    isValidPath,
    generateOptimizationReport
};
