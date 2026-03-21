/**
 * 跑腿后端 - 完整接口测试（32 个接口全测）
 * 
 * 使用方法：node full-test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function printLine() {
  print('────────────────────────────────────────────────────────────', 'cyan');
}

// 统计
let total = 0;
let passed = 0;
let failed = 0;
const results = [];

// 测试函数
async function test(name, config, expectSuccess = true) {
  total++;
  const num = `[${total.toString().padStart(2, '0')}]`;
  
  try {
    const response = await axios(config);
    const success = response.status >= 200 && response.status < 300;
    
    if (success) {
      passed++;
      print(`${num} ✅ ${name}`, 'green');
      results.push({ name, status: '✅', code: response.status });
    } else {
      failed++;
      print(`${num} ❌ ${name} (状态码：${response.status})`, 'red');
      results.push({ name, status: '❌', code: response.status });
    }
  } catch (error) {
    failed++;
    const msg = error.response?.data?.message || error.message;
    // 如果是预期内的错误（如已注册），不算失败
    if (expectSuccess || !msg.includes('已注册')) {
      print(`${num} ❌ ${name} (${msg})`, 'red');
      results.push({ name, status: '❌', error: msg });
    } else {
      print(`${num} ⚠️  ${name} (已存在)`, 'yellow');
      results.push({ name, status: '⚠️', error: msg });
    }
  }
}

// 主流程
async function runFullTest() {
  print('\n', 'reset');
  printLine();
  print('  🚀 跑腿后端 - 完整接口测试（32 个接口）', 'magenta');
  printLine();
  
  let userToken = null;
  let merchantToken = null;
  let riderToken = null;
  let orderId = null;

  // ========== 一、认证接口（4 个）==========
  print('\n【一、认证接口】（4 个）', 'cyan');
  printLine();
  
  await test('💓 健康检查', {
    method: 'GET',
    url: `${BASE_URL}/health`
  });
  
  await test(' 用户注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: { phone: '13800138111', password: '123456', nickname: '新用户', role: 'user' }
  });
  
  const loginResult = await test('🔐 用户登录', {
    method: 'POST',
    url: `${BASE_URL}/auth/login`,
    headers: { 'Content-Type': 'application/json' },
    data: { phone: '13800138000', password: '123456' }
  });
  
  // 获取用户 token（从登录接口）
  try {
    const loginResp = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '13800138000',
      password: '123456'
    });
    userToken = loginResp.data.data.token;
    print('  → 获取到用户 Token ✓', 'green');
  } catch(e) {}
  
  // 注册商家
  await test('🏪 商家注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: { phone: '13800138222', password: '123456', nickname: '新商家', role: 'merchant' }
  });
  
  // 获取商家 token
  try {
    const mResp = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '13800138001',
      password: '123456'
    });
    merchantToken = mResp.data.data.token;
    print('  → 获取到商家 Token ✓', 'green');
  } catch(e) {}
  
  // 注册骑手
  await test('🚴 骑手注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: { phone: '13800138333', password: '123456', nickname: '新骑手', role: 'rider' }
  });
  
  // 获取骑手 token
  try {
    const rResp = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '13800138002',
      password: '123456'
    });
    riderToken = rResp.data.data.token;
    print('  → 获取到骑手 Token ✓', 'green');
  } catch(e) {}
  
  if (userToken) {
    await test('👤 获取当前用户信息', {
      method: 'GET',
      url: `${BASE_URL}/auth/me`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    await test('👤 更新用户资料', {
      method: 'PUT',
      url: `${BASE_URL}/auth/profile`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: { nickname: '新昵称 2024' }
    });
  }

  // ========== 二、商家接口（9 个）==========
  print('\n【二、商家接口】（9 个）', 'cyan');
  printLine();
  
  await test('🏪 获取商家列表', {
    method: 'GET',
    url: `${BASE_URL}/merchant/list`,
    params: { page: 1, limit: 10 }
  });
  
  await test('🏪 获取商家详情', {
    method: 'GET',
    url: `${BASE_URL}/merchant/detail/1`
  });
  
  await test('🏪 获取商品分类', {
    method: 'GET',
    url: `${BASE_URL}/merchant/categories`,
    params: { merchant_id: 1 }
  });
  
  await test('🏪 获取商品列表', {
    method: 'GET',
    url: `${BASE_URL}/merchant/products`,
    params: { merchant_id: 1, status: 1 }
  });
  
  if (merchantToken) {
    await test('🏪 创建店铺', {
      method: 'POST',
      url: `${BASE_URL}/merchant/create`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '自动测试店',
        description: '测试用',
        phone: '13900000000',
        address: '测试路 1 号',
        delivery_radius: 5.0,
        min_price: 15.00,
        delivery_fee: 3.00
      }
    });
    
    await test('🏪 获取我的店铺', {
      method: 'GET',
      url: `${BASE_URL}/merchant/my`,
      headers: { 'Authorization': `Bearer ${merchantToken}` }
    });
    
    await test(' 创建商品分类', {
      method: 'POST',
      url: `${BASE_URL}/merchant/category`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: { name: '测试分类', sort: 1 }
    });
    
    await test('🏪 创建商品', {
      method: 'POST',
      url: `${BASE_URL}/merchant/product`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '测试商品',
        description: '测试用商品',
        price: 25.00,
        original_price: 30.00,
        category_id: 1,
        stock: 100
      }
    });
    
    await test('🏪 获取店铺订单', {
      method: 'GET',
      url: `${BASE_URL}/merchant/orders`,
      headers: { 'Authorization': `Bearer ${merchantToken}` }
    });
  }

  // ========== 三、订单接口（8 个）==========
  print('\n【三、订单接口】（8 个）', 'cyan');
  printLine();
  
  if (userToken && merchantToken) {
    // 创建订单
    const createResp = await test('📦 创建订单', {
      method: 'POST',
      url: `${BASE_URL}/order/create`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        merchant_id: 1,
        type: 'takeout',
        products_info: [{ id: 1, name: '测试', price: 20, quantity: 1 }],
        total_amount: 20.00,
        delivery_fee: 2.00,
        package_fee: 1.00,
        discount_amount: 0.00,
        pay_amount: 23.00,
        delivery_type: 1,
        contact_phone: '13800138000',
        contact_name: '张三',
        delivery_address: {
          province: 'XX 省',
          city: 'XX 市',
          district: 'XX 县',
          street: 'XX 街道',
          detail: 'XX 小区'
        },
        remark: '测试订单'
      }
    });
    
    // 获取订单 ID
    try {
      const cResp = await axios.post(`${BASE_URL}/order/create`, {
        merchant_id: 1,
        type: 'takeout',
        products_info: [{ id: 1, name: '测试', price: 20, quantity: 1 }],
        total_amount: 20.00,
        delivery_fee: 2.00,
        package_fee: 1.00,
        discount_amount: 0.00,
        pay_amount: 23.00,
        delivery_type: 1,
        contact_phone: '13800138000',
        contact_name: '张三',
        delivery_address: { province: 'XX 省', city: 'XX 市', detail: 'XX 小区' }
      }, {
        headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' }
      });
      orderId = cResp.data.data.id;
      print(`  → 创建订单成功，ID: ${orderId}`, 'green');
    } catch(e) {}
    
    if (orderId) {
      await test('📦 支付订单', {
        method: 'POST',
        url: `${BASE_URL}/order/pay`,
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        data: { order_id: orderId }
      });
      
      await test('📦 获取我的订单', {
        method: 'GET',
        url: `${BASE_URL}/order/my`,
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      await test('📦 获取订单详情', {
        method: 'GET',
        url: `${BASE_URL}/order/detail/${orderId}`,
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      if (merchantToken) {
        await test('📦 商家接单', {
          method: 'POST',
          url: `${BASE_URL}/order/accept`,
          headers: { 
            'Authorization': `Bearer ${merchantToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });
        
        await test('📦 商家备货完成', {
          method: 'POST',
          url: `${BASE_URL}/order/prepare`,
          headers: { 
            'Authorization': `Bearer ${merchantToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });
      }
      
      if (riderToken) {
        await test('🚴 获取可抢订单', {
          method: 'GET',
          url: `${BASE_URL}/order/available`,
          headers: { 'Authorization': `Bearer ${riderToken}` }
        });
        
        await test('🚴 骑手抢单', {
          method: 'POST',
          url: `${BASE_URL}/order/rider-accept`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });
        
        await test('🚴 骑手确认送达', {
          method: 'POST',
          url: `${BASE_URL}/order/confirm-delivery`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });
        
        await test('🚴 获取骑手订单', {
          method: 'GET',
          url: `${BASE_URL}/order/rider-orders`,
          headers: { 'Authorization': `Bearer ${riderToken}` }
        });
        
        await test('🚴 更新骑手状态', {
          method: 'POST',
          url: `${BASE_URL}/order/rider-status`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { status: 1 }
        });
      }
      
      await test('📦 取消订单', {
        method: 'POST',
        url: `${BASE_URL}/order/cancel`,
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        data: { order_id: orderId, reason: '测试取消' }
      });
    }
  }

  // ========== 四、地址接口（6 个）==========
  print('\n【四、地址接口】（6 个）', 'cyan');
  printLine();
  
  if (userToken) {
    await test('📍 获取地址列表', {
      method: 'GET',
      url: `${BASE_URL}/address/list`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    await test('📍 获取默认地址', {
      method: 'GET',
      url: `${BASE_URL}/address/default`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    await test('📍 创建地址', {
      method: 'POST',
      url: `${BASE_URL}/address/create`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        contact_name: '测试用户',
        contact_phone: '13800138000',
        province: 'XX 省',
        city: 'XX 市',
        district: 'XX 县',
        street: 'XX 街道',
        detail: 'XX 小区 1 号',
        latitude: 30.123456,
        longitude: 120.123456,
        is_default: false
      }
    });
    
    await test('📍 更新地址', {
      method: 'PUT',
      url: `${BASE_URL}/address/update`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: { id: 1, contact_name: '新联系人', is_default: true }
    });
    
    await test('📍 设置默认地址', {
      method: 'POST',
      url: `${BASE_URL}/address/set-default`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: { id: 1 }
    });
    
    // 删除地址（测试用，可能失败因为 ID 不一定存在）
    await test('📍 删除地址', {
      method: 'DELETE',
      url: `${BASE_URL}/address/delete/999`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    }, false); // expectSuccess = false
  }

  // ========== 测试总结 ==========
  print('\n', 'reset');
  printLine();
  print('  📊 测试总结', 'magenta');
  printLine();
  print(`\n  总接口数：${total}`, 'blue');
  print(`  ✅ 通过：${passed}`, 'green');
  print(`  ❌ 失败：${failed}`, 'red');
  print(`  ⚠️  已存在：${total - passed - failed}`, 'yellow');
  
  const rate = ((passed / total) * 100).toFixed(1);
  print(`  📈 成功率：${rate}%\n`, 'cyan');
  printLine();
  
  if (failed <= 3) {
    print('\n🎉 太棒了！大部分接口都正常工作！\n', 'green');
  } else {
    print(`\n⚠️  有 ${failed} 个接口需要检查\n`, 'yellow');
  }
  
  // 显示详细结果
  print('\n【详细测试结果】', 'magenta');
  printLine();
  results.forEach((r, i) => {
    print(`${(i+1).toString().padStart(2, ' ')}. ${r.status} ${r.name}`, 
      r.status === '✅' ? 'green' : r.status === '⚠️' ? 'yellow' : 'red');
  });
}

// 运行
runFullTest().catch(error => {
  print(`\n❌ 测试出错：${error.message}`, 'red');
  console.error(error);
});
