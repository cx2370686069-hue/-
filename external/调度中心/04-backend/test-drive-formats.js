const https = require('https');

function testDifferentURLFormats() {
    console.log('测试不同的 URL 格式...\n');
    
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
            name: '格式 1: GET + postStr 在 URL + type=search + tk',
            url: `https://api.tianditu.gov.cn/drive?postStr=${encodedPostStr}&type=search&tk=${TIANDITU_KEY}`,
            method: 'GET'
        },
        {
            name: '格式 2: POST + postStr 在 body + type=search + tk 在 URL',
            url: `https://api.tianditu.gov.cn/drive?type=search&tk=${TIANDITU_KEY}`,
            method: 'POST',
            body: postStr,
            contentType: 'application/json'
        },
        {
            name: '格式 3: POST + 表单 + type=search + tk 在 URL',
            url: `https://api.tianditu.gov.cn/drive?type=search&tk=${TIANDITU_KEY}`,
            method: 'POST',
            body: `postStr=${encodedPostStr}`,
            contentType: 'application/x-www-form-urlencoded'
        },
        {
            name: '格式 4: GET + postStr 在 URL + tk (不加 type)',
            url: `https://api.tianditu.gov.cn/drive?postStr=${encodedPostStr}&tk=${TIANDITU_KEY}`,
            method: 'GET'
        },
        {
            name: '格式 5: POST + JSON + tk 在 URL (不加 type)',
            url: `https://api.tianditu.gov.cn/drive?tk=${TIANDITU_KEY}`,
            method: 'POST',
            body: postStr,
            contentType: 'application/json'
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
        console.log('URL:', testCase.url.substring(0, 120) + '...');
        console.log('Method:', testCase.method);
        if (testCase.body) {
            console.log('Body:', testCase.body.substring(0, 100) + '...');
        }
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
        
        if (testCase.contentType) {
            options.headers['Content-Type'] = testCase.contentType;
        }
        
        const req = https.request(options, (res) => {
            console.log('响应状态码:', res.statusCode);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('响应数据:', data.substring(0, 300));
                
                if (data.includes('distance') || data.includes('coords')) {
                    console.log('✅ 成功！');
                } else if (data.includes('权限类型错误') || data.includes('301013')) {
                    console.log('❌ 权限类型错误 (301013)');
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

testDifferentURLFormats();
