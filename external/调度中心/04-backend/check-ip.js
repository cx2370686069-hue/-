const https = require('https');

function checkActualIP() {
    console.log('检查实际请求IP...');
    
    const TIANDITU_KEY = '9907fafafb3727a41825276271b06ee9';
    
    const postData = {
        orig: '115.654,32.168',
        dest: '115.664,32.178',
        style: '0'
    };
    
    const postStr = JSON.stringify(postData);
    
    const options = {
        hostname: 'api.tianditu.gov.cn',
        port: 443,
        path: `/drive?tk=${TIANDITU_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postStr)
        }
    };
    
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('天地图响应:', data);
            
            if (data.includes('IP不匹配')) {
                console.log('\n❌ IP不匹配错误');
                console.log('\n请检查天地图控制台的白名单配置：');
                console.log('1. 登录天地图控制台：http://lbs.tianditu.gov.cn/home.html');
                console.log('2. 找到您的应用"屋里"');
                console.log('3. 检查IP白名单配置');
                console.log('4. 确认白名单中包含：42.230.201.17');
                console.log('5. 如果有多个IP，用英文逗号分隔');
                console.log('\n建议操作：');
                console.log('- 清空白名单，重新添加IP：42.230.201.17');
                console.log('- 或者尝试添加0.0.0.0/0（允许所有IP，仅用于测试）');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('请求失败:', error.message);
    });
    
    req.setTimeout(30000, () => {
        req.destroy();
        console.error('请求超时');
    });
    
    req.write(postStr);
    req.end();
}

checkActualIP();
