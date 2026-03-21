const http = require('http');

function request(method, url, data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testTianditu() {
    console.log('测试天地图API...');
    
    try {
        const result = await request('POST', 'http://localhost:3000/api/tianditu/drive', {
            orig: '115.654,32.168',
            dest: '115.664,32.178',
            style: '0'
        });
        
        console.log('结果:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('错误:', error.message);
    }
}

testTianditu();
