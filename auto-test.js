/**
 * 跑腿后端 - 自动化测试脚本
 * 
 * 使用方法：
 * node auto-test.js
 * 
 * 会自动测试所有接口并显示结果
 */

const axios = require('axios').default;

// 配置
const BASE_URL = 'http://localhost:3000/api';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 打印函数
function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function printLine() {
  print('══════════════════════════════════════════════════════════', 'cyan');
}

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 测试函数
async function testAPI(name, config) {
  totalTests++;
  print(`\n[${totalTests}] 测试：${name}`, 'blue');
  printLine();
  
  try {
    const response = await axios(config);
    
    if (response.status >= 200 && response.status < 300) {
      passedTests++;
      print(`✅ 成功！状态码：${response.status}`, 'green');
      print(`📝 返回：${JSON.stringify(response.data, null, 2).substring(0, 500)}`);
      return response.data;
    } else {
      failedTests++;
      print(`❌ 失败！状态码：${response.status}`, 'red');
      return null;
    }
  } catch (error) {
    failedTests++;
    if (error.response) {
      print(`❌ 失败！状态码：${error.response.status}`, 'red');
      print(`📝 错误信息：${error.response.data?.message || error.response.data}`, 'red');
    } else {
      print(`❌ 失败！${error.message}`, 'red');
    }
    return null;
  }
}

// 主测试流程
async function runTests() {
  print('\n', 'reset');
  printLine();
  print('  🚀 跑腿后端 - 自动化接口测试', 'cyan');
  printLine();
  print('\n 开始测试所有接口...\n', 'yellow');

  let userToken = null;
  let merchantToken = null;
  let riderToken = null;

  // ========== 1. 认证接口测试 ==========
  print('\n【认证接口测试】', 'cyan');
  printLine();

  // 1.1 健康检查
  await testAPI('💓 健康检查', {
    method: 'GET',
    url: `${BASE_URL}/health`
  });

  // 1.2 用户注册
  const userRegisterResult = await testAPI(' 用户注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: {
      phone: '13800138000',
      password: '123456',
      nickname: '测试用户',
      role: 'user'
    }
  });

  if (userRegisterResult?.data?.token) {
    userToken = userRegisterResult.data.token;
    print(`\n✅ 获取到用户 Token: ${userToken.substring(0, 50)}...`, 'green');
  }

  // 1.3 商家注册
  const merchantRegisterResult = await testAPI('🏪 商家注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: {
      phone: '13800138001',
      password: '123456',
      nickname: '测试商家',
      role: 'merchant'
    }
  });

  if (merchantRegisterResult?.data?.token) {
    merchantToken = merchantRegisterResult.data.token;
    print(`\n✅ 获取到商家 Token: ${merchantToken.substring(0, 50)}...`, 'green');
  }

  // 1.4 骑手注册
  const riderRegisterResult = await testAPI('🚴 骑手注册', {
    method: 'POST',
    url: `${BASE_URL}/auth/register`,
    headers: { 'Content-Type': 'application/json' },
    data: {
      phone: '13800138002',
      password: '123456',
      nickname: '测试骑手',
      role: 'rider'
    }
  });

  if (riderRegisterResult?.data?.token) {
    riderToken = riderRegisterResult.data.token;
    print(`\n✅ 获取到骑手 Token: ${riderToken.substring(0, 50)}...`, 'green');
  }

  // 1.5 用户登录
  await testAPI('🔐 用户登录', {
    method: 'POST',
    url: `${BASE_URL}/auth/login`,
    headers: { 'Content-Type': 'application/json' },
    data: {
      phone: '13800138000',
      password: '123456'
    }
  });

  // 1.6 获取用户信息（需要 token）
  if (userToken) {
    await testAPI('👤 获取当前用户信息', {
      method: 'GET',
      url: `${BASE_URL}/auth/me`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
  }

  // ========== 2. 商家接口测试 ==========
  print('\n【商家接口测试】', 'cyan');
  printLine();

  // 2.1 获取商家列表
  await testAPI('🏪 获取商家列表', {
    method: 'GET',
    url: `${BASE_URL}/merchant/list`,
    params: { page: 1, limit: 10 }
  });

  // 2.2 创建店铺（需要商家 token）
  if (merchantToken) {
    await testAPI('🏪 创建店铺', {
      method: 'POST',
      url: `${BASE_URL}/merchant/create`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '测试快餐店',
        description: '正宗家常菜',
        phone: '13800138001',
        address: 'XX 县 XX 镇 XX 路 1 号',
        delivery_radius: 5.0,
        min_price: 15.00,
        delivery_fee: 3.00
      }
    });

    // 2.3 获取我的店铺
    await testAPI('🏪 获取我的店铺', {
      method: 'GET',
      url: `${BASE_URL}/merchant/my`,
      headers: { 'Authorization': `Bearer ${merchantToken}` }
    });

    // 2.4 创建商品分类
    await testAPI(' 创建商品分类', {
      method: 'POST',
      url: `${BASE_URL}/merchant/category`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '热菜',
        sort: 1
      }
    });

    // 2.5 创建商品
    await testAPI('🏪 创建商品', {
      method: 'POST',
      url: `${BASE_URL}/merchant/product`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '宫保鸡丁',
        description: '经典川菜',
        price: 28.00,
        original_price: 35.00,
        category_id: 1,
        stock: 999
      }
    });

    // 2.6 获取商品列表
    await testAPI('🏪 获取商品列表', {
      method: 'GET',
      url: `${BASE_URL}/merchant/products`,
      params: { merchant_id: 1 }
    });
  }

  // ========== 3. 地址接口测试 ==========
  print('\n【地址接口测试】', 'cyan');
  printLine();

  if (userToken) {
    // 3.1 创建地址
    await testAPI('📍 创建地址', {
      method: 'POST',
      url: `${BASE_URL}/address/create`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        contact_name: '张三',
        contact_phone: '13800138000',
        province: 'XX 省',
        city: 'XX 市',
        district: 'XX 县',
        street: 'XX 街道',
        detail: 'XX 小区 1 栋 1 单元',
        latitude: 30.123456,
        longitude: 120.123456,
        is_default: true
      }
    });

    // 3.2 获取地址列表
    await testAPI('📍 获取地址列表', {
      method: 'GET',
      url: `${BASE_URL}/address/list`,
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
  }

  // ========== 4. 订单接口测试 ==========
  print('\n【订单接口测试】', 'cyan');
  printLine();

  if (userToken && merchantToken) {
    // 先创建一个商家（用于测试订单）
    const newMerchantResult = await testAPI('🏪 创建店铺（用于订单测试）', {
      method: 'POST',
      url: `${BASE_URL}/merchant/create`,
      headers: { 
        'Authorization': `Bearer ${merchantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '测试订单店',
        description: '用于测试',
        phone: '13900139000',
        address: '测试路 1 号',
        delivery_radius: 5.0,
        min_price: 10.00,
        delivery_fee: 2.00
      }
    });

    // 4.1 创建订单
    const createOrderResult = await testAPI('📦 创建订单', {
      method: 'POST',
      url: `${BASE_URL}/order/create`,
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        merchant_id: 2,
        type: 'takeout',
        products_info: [
          { id: 1, name: '宫保鸡丁', price: 28, quantity: 1 }
        ],
        total_amount: 28.00,
        delivery_fee: 3.00,
        package_fee: 1.00,
        discount_amount: 0.00,
        pay_amount: 32.00,
        delivery_type: 1,
        contact_phone: '13800138000',
        contact_name: '张三',
        delivery_address: {
          province: 'XX 省',
          city: 'XX 市',
          district: 'XX 县',
          street: 'XX 街道',
          detail: 'XX 小区 1 栋 1 单元'
        },
        remark: '不要辣椒'
      }
    });

    if (createOrderResult?.data?.id) {
      const orderId = createOrderResult.data.id;
      print(`\n✅ 创建订单成功，订单 ID: ${orderId}`, 'green');

      // 4.2 支付订单
      await testAPI('📦 支付订单', {
        method: 'POST',
        url: `${BASE_URL}/order/pay`,
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        data: { order_id: orderId }
      });

      // 4.3 获取我的订单
      await testAPI('📦 获取我的订单', {
        method: 'GET',
        url: `${BASE_URL}/order/my`,
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      // 4.4 获取订单详情
      await testAPI('📦 获取订单详情', {
        method: 'GET',
        url: `${BASE_URL}/order/detail/${orderId}`,
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      // 4.5 商家接单
      await testAPI('📦 商家接单', {
        method: 'POST',
        url: `${BASE_URL}/order/accept`,
        headers: { 
          'Authorization': `Bearer ${merchantToken}`,
          'Content-Type': 'application/json'
        },
        data: { order_id: orderId }
      });

      // 4.6 商家拒单测试（新建一个订单来测试）
      const testRejectOrder = await testAPI('📦 创建订单（拒单测试）', {
        method: 'POST',
        url: `${BASE_URL}/order/create`,
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          merchant_id: 2,
          type: 'takeout',
          products_info: [{ id: 1, name: '测试商品', price: 20, quantity: 1 }],
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
            detail: 'XX 小区 1 栋 1 单元'
          }
        }
      });

      if (testRejectOrder?.data?.id) {
        const rejectOrderId = testRejectOrder.data.id;
        
        // 先支付
        await testAPI('📦 支付订单（拒单测试）', {
          method: 'POST',
          url: `${BASE_URL}/order/pay`,
          headers: { 
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: rejectOrderId }
        });

        // 商家拒单
        await testAPI('📦 商家拒单', {
          method: 'POST',
          url: `${BASE_URL}/order/reject`,
          headers: { 
            'Authorization': `Bearer ${merchantToken}`,
            'Content-Type': 'application/json'
          },
          data: { 
            order_id: rejectOrderId,
            reason: '食材不足'
          }
        });
      }

      // 4.7 商家备货完成
      await testAPI('📦 商家备货完成', {
        method: 'POST',
        url: `${BASE_URL}/order/prepare`,
        headers: { 
          'Authorization': `Bearer ${merchantToken}`,
          'Content-Type': 'application/json'
        },
        data: { order_id: orderId }
      });

      // 4.8 获取商家订单
      await testAPI('🏪 获取店铺订单', {
        method: 'GET',
        url: `${BASE_URL}/merchant/orders`,
        headers: { 'Authorization': `Bearer ${merchantToken}` }
      });

      // 4.9 骑手抢单
      if (riderToken) {
        await testAPI('🚴 骑手抢单', {
          method: 'POST',
          url: `${BASE_URL}/order/rider-accept`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });

        // 4.10 骑手确认送达
        await testAPI('🚴 骑手确认送达', {
          method: 'POST',
          url: `${BASE_URL}/order/confirm-delivery`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: orderId }
        });

        // 4.11 获取可抢订单列表
        await testAPI('🚴 获取可抢订单列表', {
          method: 'GET',
          url: `${BASE_URL}/order/available`,
          headers: { 'Authorization': `Bearer ${riderToken}` }
        });

        // 4.12 获取骑手配送订单
        await testAPI('🚴 获取骑手配送订单', {
          method: 'GET',
          url: `${BASE_URL}/order/rider-orders`,
          headers: { 'Authorization': `Bearer ${riderToken}` }
        });

        // 4.13 更新骑手状态
        await testAPI('🚴 更新骑手状态', {
          method: 'POST',
          url: `${BASE_URL}/order/rider-status`,
          headers: { 
            'Authorization': `Bearer ${riderToken}`,
            'Content-Type': 'application/json'
          },
          data: { status: 1 }
        });
      }

      // 4.14 取消订单（测试用）
      const cancelTestOrder = await testAPI('📦 创建订单（取消测试）', {
        method: 'POST',
        url: `${BASE_URL}/order/create`,
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          merchant_id: 2,
          type: 'takeout',
          products_info: [{ id: 1, name: '测试', price: 15, quantity: 1 }],
          total_amount: 15.00,
          delivery_fee: 2.00,
          package_fee: 0.00,
          discount_amount: 0.00,
          pay_amount: 17.00,
          delivery_type: 1,
          contact_phone: '13800138000',
          contact_name: '张三',
          delivery_address: {
            province: 'XX 省',
            city: 'XX 市',
            district: 'XX 县',
            street: 'XX 街道',
            detail: 'XX 小区'
          }
        }
      });

      if (cancelTestOrder?.data?.id) {
        const cancelOrderId = cancelTestOrder.data.id;
        // 先支付
        await testAPI('📦 支付订单（取消测试）', {
          method: 'POST',
          url: `${BASE_URL}/order/pay`,
          headers: { 
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          data: { order_id: cancelOrderId }
        });

        // 用户取消
        await testAPI('📦 取消订单', {
          method: 'POST',
          url: `${BASE_URL}/order/cancel`,
          headers: { 
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          data: { 
            order_id: cancelOrderId,
            reason: '用户不想要了'
          }
        });
      }
    }
  }

  // ========== 测试总结 ==========
  print('\n', 'reset');
  printLine();
  print('  📊 测试总结', 'cyan');
  printLine();
  print(`\n  总测试数：${totalTests}`, 'blue');
  print(`  ✅ 通过：${passedTests}`, 'green');
  print(`  ❌ 失败：${failedTests}`, 'red');
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  print(`  📈 成功率：${successRate}%\n`, 'yellow');
  printLine();

  if (failedTests === 0) {
    print('\n🎉 太棒了！所有接口测试通过！\n', 'green');
  } else {
    print(`\n⚠️  有 ${failedTests} 个接口测试失败，请检查日志\n`, 'yellow');
  }
}

// 运行测试
runTests().catch(error => {
  print(`\n❌ 测试过程中发生错误：${error.message}`, 'red');
  console.error(error);
});
