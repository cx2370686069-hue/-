#!/usr/bin/env node

/**
 * 服务器健康检查脚本
 * 用于监控后端服务和 GraphHopper 服务的运行状态
 * 适用于阿里云服务器部署后的监控
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    graphhopperUrl: process.env.GRAPHHOPPER_URL || 'http://localhost:8989',
    logFile: process.env.LOG_FILE || path.join(__dirname, 'health-check.log'),
    alertFile: process.env.ALERT_FILE || path.join(__dirname, 'health-alerts.log'),
    checkInterval: process.env.CHECK_INTERVAL ? parseInt(process.env.CHECK_INTERVAL) : 60000, // 默认1分钟
    maxRetries: 3,
    retryDelay: 5000
};

// 日志函数
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    // 输出到控制台
    console.log(logMessage.trim());
    
    // 写入日志文件
    try {
        fs.appendFileSync(CONFIG.logFile, logMessage);
    } catch (error) {
        console.error('写入日志失败:', error.message);
    }
}

// 警报函数
function alert(message) {
    const timestamp = new Date().toISOString();
    const alertMessage = `[${timestamp}] ${message}\n`;
    
    // 输出到控制台（红色）
    console.error(`\x1b[31m${alertMessage.trim()}\x1b[0m`);
    
    // 写入警报文件
    try {
        fs.appendFileSync(CONFIG.alertFile, alertMessage);
    } catch (error) {
        console.error('写入警报失败:', error.message);
    }
}

// HTTP 请求封装
function request(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: timeout
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: { raw: body }
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

// 检查后端服务
async function checkBackend(retryCount = 0) {
    const url = `${CONFIG.backendUrl}/api/health`;
    
    try {
        const response = await request(url);
        
        if (response.statusCode === 200 && response.data.success) {
            log(`后端服务正常 - ${CONFIG.backendUrl}`, 'INFO');
            return {
                status: 'ok',
                message: '后端服务正常',
                data: response.data
            };
        } else {
            throw new Error(`后端服务返回异常状态: ${response.statusCode}`);
        }
    } catch (error) {
        if (retryCount < CONFIG.maxRetries) {
            log(`后端服务检查失败，重试 ${retryCount + 1}/${CONFIG.maxRetries}: ${error.message}`, 'WARN');
            await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            return checkBackend(retryCount + 1);
        } else {
            alert(`后端服务异常: ${error.message} - ${CONFIG.backendUrl}`);
            return {
                status: 'error',
                message: error.message,
                url: CONFIG.backendUrl
            };
        }
    }
}

// 检查 GraphHopper 服务
async function checkGraphHopper(retryCount = 0) {
    const url = `${CONFIG.graphhopperUrl}/health`;
    
    try {
        const response = await request(url);
        
        if (response.statusCode === 200 && response.data.status === 'ok') {
            log(`GraphHopper服务正常 - ${CONFIG.graphhopperUrl}`, 'INFO');
            return {
                status: 'ok',
                message: 'GraphHopper服务正常',
                data: response.data
            };
        } else {
            throw new Error(`GraphHopper服务返回异常状态: ${response.data.status}`);
        }
    } catch (error) {
        if (retryCount < CONFIG.maxRetries) {
            log(`GraphHopper服务检查失败，重试 ${retryCount + 1}/${CONFIG.maxRetries}: ${error.message}`, 'WARN');
            await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            return checkGraphHopper(retryCount + 1);
        } else {
            alert(`GraphHopper服务异常: ${error.message} - ${CONFIG.graphhopperUrl}`);
            return {
                status: 'error',
                message: error.message,
                url: CONFIG.graphhopperUrl
            };
        }
    }
}

// 检查天地图 API
async function checkTianditu(retryCount = 0) {
    const url = `${CONFIG.backendUrl}/api/tianditu/drive`;
    
    try {
        const response = await request(url);
        
        // 这里只检查接口是否可访问，不检查实际返回结果
        if (response.statusCode === 200 || response.statusCode === 400) {
            log(`天地图API代理正常 - ${CONFIG.backendUrl}/api/tianditu`, 'INFO');
            return {
                status: 'ok',
                message: '天地图API代理正常'
            };
        } else {
            throw new Error(`天地图API代理返回异常状态: ${response.statusCode}`);
        }
    } catch (error) {
        if (retryCount < CONFIG.maxRetries) {
            log(`天地图API代理检查失败，重试 ${retryCount + 1}/${CONFIG.maxRetries}: ${error.message}`, 'WARN');
            await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            return checkTianditu(retryCount + 1);
        } else {
            alert(`天地图API代理异常: ${error.message}`);
            return {
                status: 'error',
                message: error.message,
                url: `${CONFIG.backendUrl}/api/tianditu`
            };
        }
    }
}

// 检查磁盘空间
function checkDiskSpace() {
    try {
        const stats = fs.statSync(CONFIG.logFile);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 100) {
            alert(`日志文件过大: ${fileSizeInMB.toFixed(2)}MB`);
            return {
                status: 'warn',
                message: `日志文件过大: ${fileSizeInMB.toFixed(2)}MB`
            };
        }
        
        return {
            status: 'ok',
            message: '磁盘空间正常'
        };
    } catch (error) {
        return {
            status: 'ok',
            message: '无法检查磁盘空间'
        };
    }
}

// 执行一次完整检查
async function runHealthCheck() {
    log('='.repeat(60));
    log('开始健康检查');
    log('='.repeat(60));
    
    const results = {
        timestamp: new Date().toISOString(),
        backend: null,
        graphhopper: null,
        tianditu: null,
        diskSpace: null
    };
    
    // 并行检查所有服务
    const [backend, graphhopper, tianditu, diskSpace] = await Promise.all([
        checkBackend(),
        checkGraphHopper(),
        checkTianditu(),
        checkDiskSpace()
    ]);
    
    results.backend = backend;
    results.graphhopper = graphhopper;
    results.tianditu = tianditu;
    results.diskSpace = diskSpace;
    
    // 汇总结果
    const allOk = backend.status === 'ok' && 
                  graphhopper.status === 'ok' && 
                  tianditu.status === 'ok';
    
    log('='.repeat(60));
    log('健康检查结果汇总');
    log('='.repeat(60));
    log(`后端服务: ${backend.status === 'ok' ? '✅ 正常' : '❌ 异常'}`);
    log(`GraphHopper: ${graphhopper.status === 'ok' ? '✅ 正常' : '❌ 异常'}`);
    log(`天地图API: ${tianditu.status === 'ok' ? '✅ 正常' : '❌ 异常'}`);
    log(`磁盘空间: ${diskSpace.status === 'ok' ? '✅ 正常' : '⚠️  警告'}`);
    log('='.repeat(60));
    
    if (allOk) {
        log('所有服务正常');
    } else {
        alert('部分服务异常，请检查！');
    }
    
    return results;
}

// 持续监控模式
async function startMonitoring() {
    log('启动持续监控模式');
    log(`检查间隔: ${CONFIG.checkInterval / 1000} 秒`);
    log(`后端地址: ${CONFIG.backendUrl}`);
    log(`GraphHopper地址: ${CONFIG.graphhopperUrl}`);
    log('');
    
    // 立即执行一次检查
    await runHealthCheck();
    
    // 定期检查
    setInterval(async () => {
        await runHealthCheck();
    }, CONFIG.checkInterval);
}

// 单次检查模式
async function runOnce() {
    const results = await runHealthCheck();
    
    // 返回退出码
    const allOk = results.backend.status === 'ok' && 
                  results.graphhopper.status === 'ok' && 
                  results.tianditu.status === 'ok';
    
    process.exit(allOk ? 0 : 1);
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'once';
    
    switch (mode) {
        case 'monitor':
            startMonitoring();
            break;
        case 'once':
            runOnce();
            break;
        default:
            console.log('使用方法:');
            console.log('  node health-check.js once    - 执行一次检查');
            console.log('  node health-check.js monitor - 持续监控模式');
            console.log('');
            console.log('环境变量:');
            console.log('  BACKEND_URL       - 后端服务地址 (默认: http://localhost:3000)');
            console.log('  GRAPHHOPPER_URL   - GraphHopper地址 (默认: http://localhost:8989)');
            console.log('  LOG_FILE          - 日志文件路径');
            console.log('  ALERT_FILE        - 警报文件路径');
            console.log('  CHECK_INTERVAL    - 检查间隔（毫秒，默认: 60000）');
            process.exit(1);
    }
}

// 处理异常
process.on('uncaughtException', (error) => {
    alert(`未捕获的异常: ${error.message}`);
    console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
    alert(`未处理的Promise拒绝: ${reason}`);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 优雅退出
process.on('SIGINT', () => {
    log('收到退出信号，停止监控');
    process.exit(0);
});

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { runHealthCheck, checkBackend, checkGraphHopper, checkTianditu };
