const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// GraphHopper API 配置
const USE_LOCAL_GRAPHHOPPER = false;
const GRAPHHOPPER_API_KEY = 'YOUR_GRAPHHOPPER_API_KEY';
const GRAPHHOPPER_BASE_URL = USE_LOCAL_GRAPHHOPPER ? 'http://localhost:8989' : 'https://graphhopper.com/api/1';

/**
 * 路线规划
 * POST /api/graphhopper/route
 * Body: { 
 *   points: [[lon1, lat1], [lon2, lat2], ...], 
 *   vehicle: 'car' | 'bike' | 'foot',
 *   locale: 'zh-CN',
 *   instructions: true,
 *   calc_points: true
 * }
 */
router.post('/route', async (req, res) => {
    try {
        const { 
            points, 
            profile = 'car',
            locale = 'zh-CN',
            instructions = true,
            calc_points = true,
            points_encoded = false
        } = req.body;

        if (!points || points.length < 2) {
            return res.status(400).json({
                success: false,
                message: '至少需要2个坐标点'
            });
        }

        console.log('GraphHopper route request:', { points, profile, locale });

        const apiUrl = buildApiUrl('/route', {
            point: points.map(p => `${p[1]},${p[0]}`),
            profile,
            locale,
            instructions,
            calc_points,
            points_encoded
        });

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        if (data.message) {
            console.error('❌ GraphHopper API错误:', data.message);
            return res.status(400).json({
                success: false,
                message: data.message,
                error: data
            });
        }

        console.log('✅ GraphHopper路线规划成功:', {
            distance: data.paths[0].distance,
            time: data.paths[0].time,
            instructions: data.paths[0].instructions?.length
        });

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ GraphHopper路线规划错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 导航指引（支持语音）
 * POST /api/graphhopper/navigate
 * Body: { 
 *   start: [lon, lat], 
 *   end: [lon, lat],
 *   vehicle: 'car',
 *   locale: 'zh-CN'
 * }
 */
router.post('/navigate', async (req, res) => {
    try {
        const { 
            start, 
            end, 
            profile = 'car',
            locale = 'zh-CN'
        } = req.body;

        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: '缺少起点或终点坐标'
            });
        }

        console.log('GraphHopper navigate request:', { start, end, profile, locale });

        const apiUrl = buildApiUrl('/route', {
            point: [`${start[1]},${start[0]}`, `${end[1]},${end[0]}`],
            profile,
            locale,
            instructions: true,
            calc_points: true,
            points_encoded: false
        });

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        if (data.message) {
            console.error('❌ GraphHopper导航错误:', data.message);
            return res.status(400).json({
                success: false,
                message: data.message,
                error: data
            });
        }

        const path = data.paths[0];
        
        res.json({
            success: true,
            data: {
                distance: path.distance,
                time: path.time,
                points: path.points,
                instructions: path.instructions.map(inst => ({
                    text: inst.text,
                    street_name: inst.street_name,
                    distance: inst.distance,
                    time: inst.time,
                    sign: inst.sign,
                    interval: inst.interval,
                    voice_instructions: inst.text
                }))
            }
        });

    } catch (error) {
        console.error('❌ GraphHopper导航错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 地理编码（地址转坐标）
 * GET /api/graphhopper/geocode?q=北京市
 */
router.get('/geocode', async (req, res) => {
    try {
        const { q, locale = 'zh-CN', limit = 5 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: '缺少查询参数 q'
            });
        }

        const apiUrl = buildApiUrl('/geocode', {
            q,
            locale,
            limit
        });

        console.log('📍 GraphHopper地理编码查询:', q);

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ GraphHopper地理编码错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 逆地理编码（坐标转地址）
 * GET /api/graphhopper/reverse-geocode?point=116.3,39.9
 */
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { point, locale = 'zh-CN' } = req.query;

        if (!point) {
            return res.status(400).json({
                success: false,
                message: '缺少坐标参数 point (格式: 经度,纬度)'
            });
        }

        const apiUrl = buildApiUrl('/geocode', {
            reverse: true,
            point,
            locale
        });

        console.log('📍 GraphHopper逆地理编码查询:', point);

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ GraphHopper逆地理编码错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 矩阵距离计算（多点距离矩阵）
 * POST /api/graphhopper/matrix
 * Body: {
 *   points: [[lon1, lat1], [lon2, lat2], ...],
 *   vehicle: 'car',
 *   out_arrays: ['distances', 'times']
 * }
 */
router.post('/matrix', async (req, res) => {
    try {
        const { 
            points, 
            profile = 'car',
            out_arrays = ['distances', 'times']
        } = req.body;

        if (!points || points.length < 2) {
            return res.status(400).json({
                success: false,
                message: '至少需要2个坐标点'
            });
        }

        console.log('GraphHopper matrix request:', { pointsCount: points.length, profile });

        const apiUrl = buildApiUrl('/matrix', {
            point: points.map(p => `${p[1]},${p[0]}`),
            profile,
            out_array: out_arrays
        });

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        if (data.message) {
            console.error('❌ GraphHopper矩阵计算错误:', data.message);
            return res.status(400).json({
                success: false,
                message: data.message,
                error: data
            });
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ GraphHopper矩阵计算错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 旅行商问题（TSP）优化
 * POST /api/graphhopper/tsp
 * Body: {
 *   points: [[lon1, lat1], [lon2, lat2], ...],
 *   vehicle: 'car',
 *   locale: 'zh-CN'
 * }
 */
router.post('/tsp', async (req, res) => {
    try {
        const { 
            points, 
            profile = 'car',
            locale = 'zh-CN'
        } = req.body;

        if (!points || points.length < 2) {
            return res.status(400).json({
                success: false,
                message: '至少需要2个坐标点'
            });
        }

        console.log('GraphHopper TSP request:', { pointsCount: points.length, profile });

        const apiUrl = buildApiUrl('/route', {
            point: points.map(p => `${p[1]},${p[0]}`),
            profile,
            locale,
            'ch.disable': true,
            optimize: true,
            instructions: true,
            calc_points: true,
            points_encoded: false
        });

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        if (data.message) {
            console.error('❌ GraphHopper TSP优化错误:', data.message);
            return res.status(400).json({
                success: false,
                message: data.message,
                error: data
            });
        }

        const path = data.paths[0];
        
        res.json({
            success: true,
            data: {
                distance: path.distance,
                time: path.time,
                points: path.points,
                instructions: path.instructions,
                snapped_waypoints: data.snapped_waypoints
            }
        });

    } catch (error) {
        console.error('❌ GraphHopper TSP优化错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * HTTP 请求工具函数
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        client.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                }
            });

        }).on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * 构建GraphHopper API URL
 */
function buildApiUrl(endpoint, params) {
    const queryString = Object.entries(params)
        .map(([key, value]) => {
            if (Array.isArray(value)) {
                return value.map(v => `${key}=${encodeURIComponent(v)}`).join('&');
            }
            return `${key}=${encodeURIComponent(value)}`;
        })
        .join('&');
    
    // 本地GraphHopper不需要API Key
    if (!USE_LOCAL_GRAPHHOPPER) {
        return `${GRAPHHOPPER_BASE_URL}${endpoint}?${queryString}&key=${GRAPHHOPPER_API_KEY}`;
    }
    
    return `${GRAPHHOPPER_BASE_URL}${endpoint}?${queryString}`;
}

module.exports = router;
