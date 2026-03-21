/**
 * 综合顺路度计算模块
 * 结合方向夹角和绕路率，判断两个订单是否适合拼单
 * 
 * 评分标准（0-100分）：
 * - 方向分（40分）：方向夹角越小得分越高
 * - 绕路分（40分）：绕路率越低得分越高
 * - 距离分（20分）：总距离越短得分越高
 */

const { calculateDirectionAngle } = require('./direction');
const { calculateDetourRate, canBatch } = require('./detour');

// 固始县政府坐标作为县城中心
const CENTER_LAT = 32.168;
const CENTER_LON = 115.654;

/**
 * 计算方向得分（0-40分）
 * @param {number} angleDiff - 方向夹角（0-180度）
 * @returns {number} 得分
 */
function calculateDirectionScore(angleDiff) {
    // 夹角0度得40分，180度得0分，线性递减
    const score = 40 * (1 - angleDiff / 180);
    return Math.round(score * 10) / 10;
}

/**
 * 计算绕路得分（0-40分）
 * @param {number} detourRate - 绕路率（%）
 * @returns {number} 得分
 */
function calculateDetourScore(detourRate) {
    // 绕路率0%得40分，100%得0分
    if (detourRate <= 0) return 40;
    if (detourRate >= 100) return 0;
    const score = 40 * (1 - detourRate / 100);
    return Math.round(score * 10) / 10;
}

/**
 * 计算距离得分（0-20分）
 * @param {number} totalDistance - 拼单总距离（公里）
 * @returns {number} 得分
 */
function calculateDistanceScore(totalDistance) {
    // 假设县城配送范围10公里内，超过10公里得0分
    const maxDistance = 15;
    if (totalDistance <= 0) return 20;
    if (totalDistance >= maxDistance) return 0;
    const score = 20 * (1 - totalDistance / maxDistance);
    return Math.round(score * 10) / 10;
}

/**
 * 计算综合顺路度评分
 * @param {Object} order1 - 第一个订单
 * @param {Object} order2 - 第二个订单
 * @param {Object} center - 中心点
 * @returns {Object} 综合评分结果
 */
function calculateMatchingScore(order1, order2, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    // 计算方向夹角
    const directionResult = calculateDirectionAngle(order1, order2, center);
    
    // 计算绕路率
    const detourResult = calculateDetourRate(center, order1, order2);
    
    // 计算各项得分
    const directionScore = calculateDirectionScore(directionResult.angleDiff);
    const detourScore = calculateDetourScore(detourResult.detourRate);
    const distanceScore = calculateDistanceScore(detourResult.combinedRoute);
    
    // 总分
    const totalScore = directionScore + detourScore + distanceScore;
    
    // 判断是否适合拼单
    const batchDecision = canBatch(detourResult.detourRate);
    
    // 综合建议
    let recommendation = '';
    let shouldBatch = false;
    
    if (totalScore >= 80) {
        recommendation = '强烈推荐拼单';
        shouldBatch = true;
    } else if (totalScore >= 60) {
        recommendation = '建议拼单';
        shouldBatch = true;
    } else if (totalScore >= 40) {
        recommendation = '谨慎拼单';
        shouldBatch = true;
    } else {
        recommendation = '不建议拼单';
        shouldBatch = false;
    }
    
    return {
        score: Math.round(totalScore * 10) / 10,
        canBatch: shouldBatch,
        recommendation,
        details: {
            direction: {
                angleDiff: directionResult.angleDiff,
                score: directionScore,
                direction1: directionResult.direction1,
                direction2: directionResult.direction2
            },
            detour: {
                rate: detourResult.detourRate,
                score: detourScore,
                singleDistance: detourResult.totalSingle,
                combinedDistance: detourResult.combinedRoute,
                savings: detourResult.savings
            },
            distance: {
                total: detourResult.combinedRoute,
                score: distanceScore
            }
        }
    };
}

/**
 * 批量匹配：为一个订单找到最佳拼单伙伴
 * @param {Object} targetOrder - 目标订单
 * @param {Array} candidateOrders - 候选订单数组
 * @param {Object} center - 中心点
 * @returns {Object} 最佳匹配结果
 */
function findBestMatch(targetOrder, candidateOrders, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const matches = candidateOrders.map(candidate => {
        const score = calculateMatchingScore(targetOrder, candidate, center);
        return {
            order: candidate,
            ...score
        };
    });
    
    // 按得分排序
    matches.sort((a, b) => b.score - a.score);
    
    // 返回最佳匹配（如果得分>=40）
    const bestMatch = matches[0];
    if (bestMatch && bestMatch.score >= 40) {
        return {
            found: true,
            bestMatch: bestMatch,
            allMatches: matches
        };
    }
    
    return {
        found: false,
        bestMatch: null,
        allMatches: matches
    };
}

/**
 * 聚类分组：将多个订单分成若干拼单组
 * @param {Array} orders - 订单数组
 * @param {Object} center - 中心点
 * @returns {Array} 拼单组数组
 */
function groupOrders(orders, center = { lat: CENTER_LAT, lon: CENTER_LON }) {
    const groups = [];
    const ungrouped = [...orders];
    
    while (ungrouped.length > 0) {
        const current = ungrouped.shift();
        const group = [current];
        
        // 寻找可以拼单的订单
        let i = 0;
        while (i < ungrouped.length && group.length < 3) { // 最多3单拼一起
            const candidate = ungrouped[i];
            const match = calculateMatchingScore(current, candidate, center);
            
            // 检查与组内所有订单的兼容性
            let compatible = true;
            for (const member of group) {
                const groupMatch = calculateMatchingScore(member, candidate, center);
                if (groupMatch.score < 40) {
                    compatible = false;
                    break;
                }
            }
            
            if (compatible && match.score >= 50) {
                group.push(candidate);
                ungrouped.splice(i, 1);
            } else {
                i++;
            }
        }
        
        groups.push({
            orders: group,
            count: group.length,
            isBatch: group.length > 1
        });
    }
    
    return groups;
}

/**
 * 获取拼单匹配的文字报告
 * @param {Object} result - 匹配结果
 * @returns {string} 报告文本
 */
function generateMatchingReport(result) {
    const lines = [];
    lines.push('========== 拼单匹配报告 ==========');
    lines.push(`综合评分: ${result.score}/100`);
    lines.push(`拼单建议: ${result.recommendation}`);
    lines.push('');
    lines.push('【详细得分】');
    lines.push(`  方向得分: ${result.details.direction.score}/40`);
    lines.push(`    - 方向夹角: ${result.details.direction.angleDiff}°`);
    lines.push(`    - 订单1方向: ${result.details.direction.direction1}`);
    lines.push(`    - 订单2方向: ${result.details.direction.direction2}`);
    lines.push('');
    lines.push(`  绕路得分: ${result.details.detour.score}/40`);
    lines.push(`    - 绕路率: ${result.details.detour.rate}%`);
    lines.push(`    - 单独配送: ${result.details.detour.singleDistance}km`);
    lines.push(`    - 拼单配送: ${result.details.detour.combinedDistance}km`);
    lines.push(`    - 节省距离: ${result.details.detour.savings}km`);
    lines.push('');
    lines.push(`  距离得分: ${result.details.distance.score}/20`);
    lines.push(`    - 总距离: ${result.details.distance.total}km`);
    
    return lines.join('\n');
}

module.exports = {
    calculateMatchingScore,
    findBestMatch,
    groupOrders,
    generateMatchingReport,
    calculateDirectionScore,
    calculateDetourScore,
    calculateDistanceScore
};
