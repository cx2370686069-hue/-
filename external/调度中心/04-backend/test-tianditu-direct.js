const https = require('https');

function testTiandituDirect() {
    console.log('直接测试天地图API...');
    
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
    
    console.log('请求URL:', apiUrl.substring(0, 100) + '...');
    
    const options = {
        hostname: 'api.tianditu.gov.cn',
        port: 443,
        path: `/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    };
    
    const req = https.request(options, (res) => {
        console.log('状态码:', res.statusCode);
        console.log('响应头:', JSON.stringify(res.headers, null, 2));
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('响应数据:', data.substring(0, 500));
            
            if (data.includes('IP不匹配')) {
                console.log('\n❌ IP不匹配错误');
                console.log('建议：');
                console.log('1. 检查天地图控制台的白名单配置');
                console.log('2. 确认白名单格式：42.230.201.17');
                console.log('3. 检查是否有多个IP，用逗号分隔');
                console.log('4. 尝试清空白名单后重新添加');
            } else if (data.includes('errCode')) {
                console.log('\n❌ 天地图API错误');
                const errCodeMatch = data.match(/<errCode>(\d+)<\/errCode>/);
                const errMsgMatch = data.match(/<errMsg>([^<]+)<\/errMsg>/);
                if (errCodeMatch && errMsgMatch) {
                    console.log(`错误码: ${errCodeMatch[1]}`);
                    console.log(`错误信息: ${errMsgMatch[1]}`);
                }
            } else {
                console.log('\n✅ 天地图API调用成功');
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

testTiandituDirect();
