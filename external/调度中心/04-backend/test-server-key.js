const https = require('https');

function testServerKey() {
    console.log('测试天地图服务器端 Key 的正确使用方式...\n');
    
    const TIANDITU_KEY = '9907fafafb3727a41825276271b06ee9';
    const orig = '115.654,32.168';
    const dest = '115.664,32.178';
    const style = '0';
    
    const postData = {
        orig,
        dest,
        style: style.toString()
    };
    
    const postStr = JSON.stringify(postData);
    const encodedPostStr = encodeURIComponent(postStr);
    
    // 关键测试：tk 在 URL 中 + Authorization 在 header 中
    const options = {
        hostname: 'api.tianditu.gov.cn',
        port: 443,
        path: `/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Authorization': `Bearer ${TIANDITU_KEY}`,
            'X-Tianditu-Token': TIANDITU_KEY
        }
    };
    
    console.log('测试：tk 在 URL 中 + Authorization Bearer + X-Tianditu-Token');
    console.log('请求 URL:', `https://api.tianditu.gov.cn/drive?postStr=...&type=search&tk=${TIANDITU_KEY}`);
    console.log('请求头:', JSON.stringify(options.headers, null, 2));
    console.log('');
    
    const req = https.request(options, (res) => {
        console.log('响应状态码:', res.statusCode);
        console.log('响应头:', JSON.stringify(res.headers, null, 2));
        console.log('');
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('响应数据:');
            console.log(data);
            console.log('');
            
            if (data.includes('distance') || data.includes('coords')) {
                console.log('✅ 成功！服务器端 Key 需要在 header 中添加认证信息');
            } else if (data.includes('权限类型错误') || data.includes('301013')) {
                console.log('❌ 仍然是权限类型错误');
                console.log('');
                console.log('解决方案：');
                console.log('1. 登录天地图控制台 (console.tianditu.gov.cn)');
                console.log('2. 删除当前的服务器端 Key 应用');
                console.log('3. 创建一个新的应用，应用类型选择"浏览器端"');
                console.log('4. 使用新的浏览器端 Key 替换代码中的 Key');
            } else if (data.includes('errCode')) {
                const errCodeMatch = data.match(/<errCode>(\d+)<\/errCode>/);
                const errMsgMatch = data.match(/<errMsg>([^<]+)<\/errMsg>/);
                if (errCodeMatch && errMsgMatch) {
                    console.log(`❌ 错误码：${errCodeMatch[1]}, 错误信息：${errMsgMatch[1]}`);
                }
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('请求失败:', error.message);
    });
    
    req.end();
}

testServerKey();
