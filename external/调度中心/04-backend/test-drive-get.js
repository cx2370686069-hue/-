const https = require('https');

function testDriveGet() {
    console.log('测试天地图 Drive 接口（GET 方式，postStr 在 URL 中）...');
    
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
    
    const apiUrl = `https://api.tianditu.gov.cn/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`;
    
    console.log('请求 URL:', apiUrl.substring(0, 150) + '...');
    console.log('postStr:', postStr);
    console.log('encodedPostStr:', encodedPostStr);
    console.log('');
    
    const options = {
        hostname: 'api.tianditu.gov.cn',
        port: 443,
        path: `/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    };
    
    console.log('请求选项:');
    console.log('  method:', options.method);
    console.log('  headers:', JSON.stringify(options.headers));
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
            
            if (data.includes('权限类型错误') || data.includes('301013')) {
                console.log('❌ 权限类型错误 (301013)');
                console.log('');
                console.log('可能原因：');
                console.log('1. 服务器端 Key 需要在 HTTP 请求头中添加 Token');
                console.log('2. 服务器端 Key 需要在 body 中传递，而不是 URL');
                console.log('3. 需要检查天地图文档中服务器端 Key 的正确用法');
            } else if (data.includes('errCode')) {
                const errCodeMatch = data.match(/<errCode>(\d+)<\/errCode>/);
                const errMsgMatch = data.match(/<errMsg>([^<]+)<\/errMsg>/);
                if (errCodeMatch && errMsgMatch) {
                    console.log(`❌ 天地图 API 错误`);
                    console.log(`   错误码：${errCodeMatch[1]}`);
                    console.log(`   错误信息：${errMsgMatch[1]}`);
                }
            } else if (data.includes('distance') || data.includes('coords')) {
                console.log('✅ 天地图 API 调用成功！');
            } else {
                console.log('⚠️  未知响应格式');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('请求失败:', error.message);
        console.error('错误代码:', error.code);
    });
    
    req.setTimeout(30000, () => {
        req.destroy();
        console.error('请求超时');
    });
    
    req.end();
}

testDriveGet();
