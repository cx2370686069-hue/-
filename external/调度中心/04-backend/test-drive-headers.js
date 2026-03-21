const https = require('https');

function testWithHeaders() {
    console.log('测试天地图 Drive 接口（带不同请求头）...\n');
    
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
    
    const testCases = [
        {
            name: '测试 1: 仅 tk 参数（当前方式）',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            path: `/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`
        },
        {
            name: '测试 2: tk + Authorization Bearer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Authorization': `Bearer ${TIANDITU_KEY}`
            },
            path: `/drive?postStr=${encodedPostStr}&type=search`
        },
        {
            name: '测试 3: tk + X-Tianditu-Token',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Tianditu-Token': TIANDITU_KEY
            },
            path: `/drive?postStr=${encodedPostStr}&type=search`
        },
        {
            name: '测试 4: tk + Authorization Basic',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Authorization': `Basic ${Buffer.from(TIANDITU_KEY).toString('base64')}`
            },
            path: `/drive?postStr=${encodedPostStr}&type=search`
        },
        {
            name: '测试 5: POST + JSON body + tk 在 URL',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json'
            },
            path: `/drive?tk=${TIANDITU_KEY}`,
            method: 'POST',
            body: postStr
        },
        {
            name: '测试 6: POST + 表单 + tk 在 URL',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            path: `/drive?tk=${TIANDITU_KEY}`,
            method: 'POST',
            body: `postStr=${encodedPostStr}`
        }
    ];
    
    let testIndex = 0;
    
    function runTest() {
        if (testIndex >= testCases.length) {
            console.log('\n所有测试完成');
            return;
        }
        
        const testCase = testCases[testIndex];
        console.log(`\n${'='.repeat(60)}`);
        console.log(testCase.name);
        console.log('='.repeat(60));
        
        const options = {
            hostname: 'api.tianditu.gov.cn',
            port: 443,
            path: testCase.path,
            method: testCase.method || 'GET',
            headers: testCase.headers
        };
        
        console.log('请求方法:', options.method);
        console.log('请求路径:', options.path.substring(0, 100) + '...');
        console.log('请求头:', JSON.stringify(options.headers, null, 2));
        if (testCase.body) {
            console.log('请求体:', testCase.body.substring(0, 100) + '...');
        }
        console.log('');
        
        const req = https.request(options, (res) => {
            console.log('响应状态码:', res.statusCode);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('响应数据:', data.substring(0, 300));
                
                if (data.includes('权限类型错误') || data.includes('301013')) {
                    console.log('❌ 权限类型错误 (301013)');
                } else if (data.includes('distance') || data.includes('coords')) {
                    console.log('✅ 成功！');
                } else if (data.includes('errCode')) {
                    const errCodeMatch = data.match(/<errCode>(\d+)<\/errCode>/);
                    const errMsgMatch = data.match(/<errMsg>([^<]+)<\/errMsg>/);
                    if (errCodeMatch && errMsgMatch) {
                        console.log(`❌ 错误码：${errCodeMatch[1]}, 错误信息：${errMsgMatch[1]}`);
                    }
                } else {
                    console.log('⚠️  未知响应');
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
        
        if (testCase.body) {
            req.write(testCase.body);
        }
        
        req.end();
    }
    
    runTest();
}

testWithHeaders();
