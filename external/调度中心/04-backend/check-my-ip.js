const https = require('https');

function checkMyIP() {
    console.log('检查当前服务器的出口 IP...\n');
    
    // 方法 1: 通过 httpbin.org 获取 IP
    const options1 = {
        hostname: 'httpbin.org',
        port: 443,
        path: '/ip',
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    };
    
    console.log('方法 1: 通过 httpbin.org 获取 IP');
    const req1 = https.request(options1, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('响应:', data);
            console.log('');
        });
    });
    
    req1.on('error', (error) => {
        console.error('方法 1 失败:', error.message);
    });
    req1.end();
    
    // 方法 2: 通过 ipify.org 获取 IP
    setTimeout(() => {
        console.log('方法 2: 通过 ipify.org 获取 IP');
        const options2 = {
            hostname: 'api.ipify.org',
            port: 443,
            path: '/?format=json',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };
        
        const req2 = https.request(options2, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('响应:', data);
                console.log('');
                console.log('===========================================');
                console.log('重要提示:');
                console.log('===========================================');
                console.log('1. 上面的 IP 就是你当前服务器的出口 IP');
                console.log('2. 登录天地图控制台：https://console.tianditu.gov.cn');
                console.log('3. 找到你的服务器端 Key 应用');
                console.log('4. 在 IP 白名单中添加这个 IP');
                console.log('5. 保存后等待几分钟再测试');
                console.log('===========================================');
            });
        });
        
        req2.on('error', (error) => {
            console.error('方法 2 失败:', error.message);
        });
        req2.end();
    }, 1000);
}

checkMyIP();
