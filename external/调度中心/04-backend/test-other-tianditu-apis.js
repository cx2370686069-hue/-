const https = require('https');

function testOtherAPIs() {
    console.log('测试天地图其他 API 接口...\n');
    
    const TIANDITU_KEY = '9907fafafb3727a41825276271b06ee9';
    
    const testCases = [
        {
            name: '测试 1: 地理编码查询（Web 服务 API）',
            url: `https://api.tianditu.gov.cn/geocoder?ds={"address":"北京市朝阳区","city":"北京市"}&type=search&tk=${TIANDITU_KEY}`,
            method: 'GET'
        },
        {
            name: '测试 2: 逆地理编码查询（Web 服务 API）',
            url: `https://api.tianditu.gov.cn/v2/geocode?lon=116.480881&lat=39.989410&tk=${TIANDITU_KEY}`,
            method: 'GET'
        },
        {
            name: '测试 3: 地名搜索 V2.0',
            url: `https://api.tianditu.gov.cn/search?ds={"keyWord":"天安门","city":"北京市","start":0,"count":10}&type=search&tk=${TIANDITU_KEY}`,
            method: 'GET'
        }
    ];
    
    let testIndex = 0;
    
    function runTest() {
        if (testIndex >= testCases.length) {
            console.log('\n所有测试完成');
            console.log('\n===========================================');
            console.log('总结:');
            console.log('===========================================');
            console.log('如果所有 API 都返回 301013 错误，说明 Key 本身有问题');
            console.log('如果其他 API 能正常使用，只有 drive 接口不行，说明 drive 接口有特殊要求');
            console.log('===========================================');
            return;
        }
        
        const testCase = testCases[testIndex];
        console.log(`\n${'='.repeat(60)}`);
        console.log(testCase.name);
        console.log('='.repeat(60));
        console.log('URL:', testCase.url.substring(0, 120) + '...');
        console.log('');
        
        const urlObj = new URL(testCase.url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: testCase.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        const req = https.request(options, (res) => {
            console.log('响应状态码:', res.statusCode);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('响应数据:', data.substring(0, 400));
                
                if (res.statusCode === 200 && !data.includes('301013')) {
                    console.log('✅ 成功！');
                } else if (data.includes('权限类型错误') || data.includes('301013')) {
                    console.log('❌ 权限类型错误 (301013)');
                } else {
                    console.log('⚠️  其他响应');
                }
                
                testIndex++;
                setTimeout(runTest, 1000);
            });
        });
        
        req.on('error', (error) => {
            console.error('请求失败:', error.message);
            testIndex++;
            setTimeout(runTest, 1000);
        });
        
        req.end();
    }
    
    runTest();
}

testOtherAPIs();
