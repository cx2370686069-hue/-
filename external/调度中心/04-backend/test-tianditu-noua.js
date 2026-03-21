const https = require('https');

function testTiandituNoUA() {
    console.log('测试天地图API（无User-Agent）...');
    
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
    
    console.log('请求选项（无User-Agent）:', JSON.stringify(options, null, 2));
    
    const req = https.request(options, (res) => {
        console.log('\n状态码:', res.statusCode);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('响应数据:', data.substring(0, 500));
            
            if (data.includes('权限类型错误')) {
                console.log('\n❌ 仍然是权限类型错误');
                console.log('\n建议：');
                console.log('1. 联系天地图技术支持，询问服务器端Key的正确使用方式');
                console.log('2. 或者申请一个浏览器端Key试试');
                console.log('3. 检查天地图控制台，确认Key类型是否正确');
            } else {
                console.log('\n✅ 天地图API调用成功！');
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('\n请求失败:', error.message);
    });
    
    req.setTimeout(30000, () => {
        req.destroy();
        console.error('\n请求超时');
    });
    
    req.write(postStr);
    req.end();
}

testTiandituNoUA();
