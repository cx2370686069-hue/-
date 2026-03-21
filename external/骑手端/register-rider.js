const http = require('http');

const data = JSON.stringify({
  phone: '13800138002',
  password: '123456',
  nickname: '测试骑手',
  role: 'rider'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const result = JSON.parse(body);
    
    if (res.statusCode === 200) {
      console.log('✅ 骑手账号注册成功！');
      console.log('账号信息：');
      console.log('  手机号：13800138002');
      console.log('  密码：123456');
      console.log('  角色：rider（骑手）');
      console.log('\n现在可以用这个账号登录了！');
    } else {
      console.log('❌ 注册失败:', result.message || result.msg);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.log('\n请确保后端服务正在运行（npm start）');
});

req.write(data);
req.end();
