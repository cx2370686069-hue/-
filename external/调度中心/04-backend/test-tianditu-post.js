const https = require('https');

function testTiandituPost() {
    console.log('测试天地图API（POST方式）...');
    
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
            'Content-Length': Buffer.byteLength(postStr),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    };
    
    console.log('请求选项:', JSON.stringify(options, null, 2));
    console.log('请求体:', postStr);
    
    const req = https.request(options, (res) => {
        console.log('\n状态码:', res.statusCode);
        console.log('响应头:', JSON.stringify(res.headers, null, 2));
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('\n响应数据:');
            console.log(data.substring(0, 1000));
            
            if (data.includes('权限类型错误')) {
                console.log('\n❌ 仍然是权限类型错误');
                console.log('\n可能的原因：');
                console.log('1. 请求方式不对（可能需要使用特定的Content-Type）');
                console.log('2. 参数格式不对（可能需要使用表单数据）');
                console.log('3. 需要额外的请求头');
            } else if (data.includes('IP不匹配')) {
                console.log('\n❌ IP不匹配');
            } else if (data.includes('errCode')) {
                const errCodeMatch = data.match(/<errCode>(\d+)<\/errCode>/);
                const errMsgMatch = data.match(/<errMsg>([^<]+)<\/errMsg>/);
                if (errCodeMatch && errMsgMatch) {
                    console.log(`\n错误码: ${errCodeMatch[1]}`);
                    console.log(`错误信息: ${errMsgMatch[1]}`);
                }
            } else {
                console.log('\n✅ 天地图API调用成功！');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('\n请求失败:', error.message);
        console.error('错误代码:', error.code);
    });
    
    req.setTimeout(30000, () => {
        req.destroy();
        console.error('\n请求超时');
    });
    
    req.write(postStr);
    req.end();
}

testTiandituPost();
