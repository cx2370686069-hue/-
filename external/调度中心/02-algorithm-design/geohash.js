/**
 * GeoHash 编码/解码模块
 * 用于将经纬度坐标编码为字符串，便于空间索引和邻近查询
 * 
 * 精度说明：
 * - 精度5：约 2.4km x 4.8km 的格子
 * - 精度6：约 0.6km x 1.2km 的格子
 * - 精度7：约 0.15km x 0.3km 的格子
 */

// GeoHash 编码表（32个字符）
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * 将经纬度编码为 GeoHash 字符串
 * @param {number} lat - 纬度 (-90 ~ 90)
 * @param {number} lon - 经度 (-180 ~ 180)
 * @param {number} precision - 精度（字符数，默认6）
 * @returns {string} GeoHash 字符串
 */
function encode(lat, lon, precision = 6) {
    if (lat < -90 || lat > 90) {
        throw new Error('纬度必须在 -90 到 90 之间');
    }
    if (lon < -180 || lon > 180) {
        throw new Error('经度必须在 -180 到 180 之间');
    }

    let latRange = [-90.0, 90.0];
    let lonRange = [-180.0, 180.0];
    let isEven = true;  // 交替处理经度和纬度
    let bit = 0;
    let ch = 0;
    let geohash = '';

    while (geohash.length < precision) {
        if (isEven) {
            // 处理经度
            const mid = (lonRange[0] + lonRange[1]) / 2;
            if (lon >= mid) {
                ch |= (1 << (4 - bit));
                lonRange[0] = mid;
            } else {
                lonRange[1] = mid;
            }
        } else {
            // 处理纬度
            const mid = (latRange[0] + latRange[1]) / 2;
            if (lat >= mid) {
                ch |= (1 << (4 - bit));
                latRange[0] = mid;
            } else {
                latRange[1] = mid;
            }
        }

        isEven = !isEven;
        
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }

    return geohash;
}

/**
 * 将 GeoHash 字符串解码为经纬度坐标
 * @param {string} geohash - GeoHash 字符串
 * @returns {Object} 包含经纬度和误差范围的对象
 */
function decode(geohash) {
    if (!geohash || typeof geohash !== 'string') {
        throw new Error('GeoHash 必须是字符串');
    }

    let latRange = [-90.0, 90.0];
    let lonRange = [-180.0, 180.0];
    let isEven = true;

    for (let i = 0; i < geohash.length; i++) {
        const ch = geohash[i].toLowerCase();
        const val = BASE32.indexOf(ch);
        
        if (val === -1) {
            throw new Error(`无效的 GeoHash 字符: ${ch}`);
        }

        for (let j = 4; j >= 0; j--) {
            const bit = (val >> j) & 1;
            
            if (isEven) {
                // 经度
                const mid = (lonRange[0] + lonRange[1]) / 2;
                if (bit === 1) {
                    lonRange[0] = mid;
                } else {
                    lonRange[1] = mid;
                }
            } else {
                // 纬度
                const mid = (latRange[0] + latRange[1]) / 2;
                if (bit === 1) {
                    latRange[0] = mid;
                } else {
                    latRange[1] = mid;
                }
            }
            
            isEven = !isEven;
        }
    }

    const lat = (latRange[0] + latRange[1]) / 2;
    const lon = (lonRange[0] + lonRange[1]) / 2;
    const latError = (latRange[1] - latRange[0]) / 2;
    const lonError = (lonRange[1] - lonRange[0]) / 2;

    return {
        lat: parseFloat(lat.toFixed(6)),
        lon: parseFloat(lon.toFixed(6)),
        latError: parseFloat(latError.toFixed(6)),
        lonError: parseFloat(lonError.toFixed(6))
    };
}

/**
 * 获取 GeoHash 的相邻格子（8个方向）
 * @param {string} geohash - GeoHash 字符串
 * @returns {Object} 包含8个方向相邻格子的对象
 */
function getNeighbors(geohash) {
    const neighbors = {};
    const directions = [
        ['n', 'north'], ['s', 'south'], 
        ['e', 'east'], ['w', 'west'],
        ['ne', 'northeast'], ['nw', 'northwest'],
        ['se', 'southeast'], ['sw', 'southwest']
    ];
    
    // 简化的相邻格子计算（基于解码后重新编码）
    const center = decode(geohash);
    const precision = geohash.length;
    
    // 根据精度计算偏移量
    const latOffset = center.latError * 2;
    const lonOffset = center.lonError * 2;
    
    neighbors.north = encode(center.lat + latOffset, center.lon, precision);
    neighbors.south = encode(center.lat - latOffset, center.lon, precision);
    neighbors.east = encode(center.lat, center.lon + lonOffset, precision);
    neighbors.west = encode(center.lat, center.lon - lonOffset, precision);
    neighbors.northeast = encode(center.lat + latOffset, center.lon + lonOffset, precision);
    neighbors.northwest = encode(center.lat + latOffset, center.lon - lonOffset, precision);
    neighbors.southeast = encode(center.lat - latOffset, center.lon + lonOffset, precision);
    neighbors.southwest = encode(center.lat - latOffset, center.lon - lonOffset, precision);
    
    return neighbors;
}

/**
 * 计算两个 GeoHash 字符串表示的区域是否相邻或重叠
 * @param {string} hash1 - 第一个 GeoHash
 * @param {string} hash2 - 第二个 GeoHash
 * @returns {boolean} 是否相邻
 */
function isAdjacent(hash1, hash2) {
    if (hash1 === hash2) return true;
    
    const neighbors = getNeighbors(hash1);
    return Object.values(neighbors).includes(hash2);
}

/**
 * 获取指定精度的 GeoHash 格子大小（近似值，单位：公里）
 * @param {number} precision - 精度
 * @returns {Object} 宽度和高度（公里）
 */
function getPrecisionSize(precision) {
    // 基于赤道附近的近似值
    const sizes = {
        1: { width: 5000, height: 5000 },
        2: { width: 1250, height: 1250 },
        3: { width: 156, height: 156 },
        4: { width: 39, height: 39 },
        5: { width: 4.9, height: 4.9 },
        6: { width: 1.2, height: 1.2 },
        7: { width: 0.15, height: 0.15 },
        8: { width: 0.038, height: 0.038 }
    };
    
    return sizes[precision] || sizes[6];
}

module.exports = {
    encode,
    decode,
    getNeighbors,
    isAdjacent,
    getPrecisionSize,
    BASE32
};
