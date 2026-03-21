/**
 * 天地图 API 代理路由
 * 用于后端转发天地图 Web 服务请求，保护服务器端密钥
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// 天地图服务器端密钥（使用"屋里"应用的密钥）
const TIANDITU_KEY = '9907fafafb3727a41825276271b06ee9';

/**
 * 驾车路线规划
 * POST /api/tianditu/drive
 * Body: { orig: "经度，纬度", dest: "经度，纬度", mid?: "经度，纬度;...", style?: "0-3" }
 */
router.post('/drive', async (req, res) => {
    try {
        const { orig, dest, mid, style = '0' } = req.body;

        // 参数验证
        if (!orig || !dest) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数：orig (起点) 和 dest (终点)'
            });
        }

        // 构建请求参数
        const postData = {
            orig,
            dest,
            style: style.toString()
        };

        // 如果有途经点
        if (mid) {
            postData.mid = mid;
        }

        const postStr = JSON.stringify(postData);
        const encodedPostStr = encodeURIComponent(postStr);

        // drive 接口对服务器端 Key 的调用方式较严格：
        // 采用 GET 方式，postStr 放在 URL 参数中（与 test-tianditu-direct.js 一致）
        // - URL: /drive?postStr=...&type=search&tk=...
        // - method: GET
        const apiUrl = `https://api.tianditu.gov.cn/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`;

        console.log('🗺️ 天地图驾车规划请求:', { orig, dest, style });

        // 转发请求到天地图（GET 方式）
        const result = await makeRequest(apiUrl);

        // 解析XML响应
        const parsedResult = parseDrivingXML(result);

        if (!parsedResult.success) {
            console.error('❌ 天地图API错误:', parsedResult.message);
            return res.status(400).json({
                success: false,
                message: parsedResult.message || '天地图API调用失败',
                tiandituError: parsedResult
            });
        }

        console.log('✅ 天地图驾车规划成功:', parsedResult);

        // 返回成功结果
        res.json({
            success: true,
            data: parsedResult
        });

    } catch (error) {
        console.error('❌ 驾车规划代理错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 地理编码查询（地址转坐标）
 * GET /api/tianditu/geocode?address=北京市
 */
router.get('/geocode', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: address (地址)'
            });
        }

        const ds = JSON.stringify({ keyWord: address });
        const apiUrl = `http://api.tianditu.gov.cn/geocoder?ds=${encodeURIComponent(ds)}&tk=${TIANDITU_KEY}`;

        console.log('📍 地理编码查询:', address);

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ 地理编码代理错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 逆地理编码查询（坐标转地址）
 * GET /api/tianditu/reverse-geocode?lon=116.3&lat=39.9
 */
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { lon, lat } = req.query;

        if (!lon || !lat) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: lon (经度) 和 lat (纬度)'
            });
        }

        const postStr = JSON.stringify({
            lon: parseFloat(lon),
            lat: parseFloat(lat),
            ver: 1
        });

        const apiUrl = `http://api.tianditu.gov.cn/geocoder?postStr=${encodeURIComponent(postStr)}&type=geocode&tk=${TIANDITU_KEY}`;

        console.log('📍 逆地理编码查询:', { lon, lat });

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ 逆地理编码代理错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 地名搜索
 * GET /api/tianditu/search?keyword=餐厅&city=北京
 */
router.get('/search', async (req, res) => {
    try {
        const { keyword, city, queryType = '1', start = '0', count = '10' } = req.query;

        if (!keyword) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: keyword (搜索关键词)'
            });
        }

        const searchParams = {
            keyWord: keyword,
            queryType: queryType,
            start: start,
            count: count
        };

        if (city) {
            searchParams.specify = city;
        }

        const postStr = JSON.stringify(searchParams);
        const apiUrl = `http://api.tianditu.gov.cn/v2/search?postStr=${encodeURIComponent(postStr)}&type=query&tk=${TIANDITU_KEY}`;

        console.log('🔍 地名搜索:', keyword, city ? `(${city})` : '');

        const result = await makeRequest(apiUrl);
        const data = JSON.parse(result);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ 地名搜索代理错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
});

/**
 * 获取本机出口IP（用于调试）
 * GET /api/tianditu/myip
 */
router.get('/myip', async (req, res) => {
    try {
        // 请求一个返回IP的服务
        const ipApiUrl = 'http://httpbin.org/ip';
        const result = await makeRequest(ipApiUrl);
        const data = JSON.parse(result);
        
        res.json({
            success: true,
            message: '后端服务器出口IP',
            origin: data.origin,
            note: '请将此IP添加到天地图白名单'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取IP失败',
            error: error.message
        });
    }
});

/**
 * HTTP 请求工具函数
 */
function makeRequest(url, postData = null) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (url.startsWith('https') ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: postData ? 'POST' : 'GET',
            headers: {
                // 注意：GET 请求不建议强行携带 Content-Type
                // 以免触发天地图的“权限类型错误”等鉴权/策略差异
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        if (postData) {
            options.headers['Content-Type'] = 'application/json';
        }

        const req = client.request(options, (response) => {
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
        
        if (postData) {
            req.write(postData);
        }
        
        req.end();
    });
}

/**
 * HTTP 请求工具函数（POST 表单）
 */
function makeFormRequest(url, postBody) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (url.startsWith('https') ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Length': Buffer.byteLength(postBody)
            }
        };

        const req = client.request(options, (response) => {
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

        req.write(postBody);
        req.end();
    });
}

/**
 * 解析天地图驾车路线XML响应
 */
function parseDrivingXML(xmlText) {
    try {
        // 检查是否有错误
        const errCodeMatch = xmlText.match(/<errCode>(\d+)<\/errCode>/);
        const errMsgMatch = xmlText.match(/<errMsg>([^<]+)<\/errMsg>/);

        if (errCodeMatch && errCodeMatch[1] !== '0') {
            return {
                success: false,
                message: errMsgMatch ? errMsgMatch[1] : '天地图API返回错误',
                errCode: errCodeMatch[1]
            };
        }

        // 提取距离（米）
        const distanceMatch = xmlText.match(/<distance>([\d.]+)<\/distance>/);
        const distance = distanceMatch ? parseFloat(distanceMatch[1]) : 0;

        // 提取时间（秒）
        const durationMatch = xmlText.match(/<duration>([\d.]+)<\/duration>/);
        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

        // 提取路线点
        const points = [];
        const coordsMatch = xmlText.match(/<coords>([^<]+)<\/coords>/);
        if (coordsMatch) {
            const coordsStr = coordsMatch[1].trim();
            const coordPairs = coordsStr.split(';');
            coordPairs.forEach(pair => {
                const [lon, lat] = pair.split(',').map(Number);
                if (!isNaN(lon) && !isNaN(lat)) {
                    points.push({ lon, lat });
                }
            });
        }

        return {
            success: true,
            distance: distance,
            duration: duration,
            routePoints: points
        };
    } catch (error) {
        return {
            success: false,
            message: 'XML解析失败: ' + error.message
        };
    }
}

module.exports = router;
