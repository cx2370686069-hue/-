const { User, Order, Merchant, sequelize } = require('../models');

async function insertTestOrders() {
  try {
    const rider = await User.findOne({
      where: { phone: '13800138000', role: 'rider' }
    });

    if (!rider) {
      console.error('❌ 未找到测试骑手账号（手机号: 13800138000）');
      process.exit(1);
    }

    console.log(`✅ 找到骑手: ID=${rider.id}, 昵称=${rider.nickname}, 手机=${rider.phone}`);

    let merchant = await Merchant.findOne();
    if (!merchant) {
      console.log('⚠️ 没有商家，创建一个测试商家...');
      const testMerchantUser = await User.create({
        phone: '99999999999',
        password: '123456',
        nickname: '测试商家',
        role: 'merchant',
        status: 1
      });
      merchant = await Merchant.create({
        user_id: testMerchantUser.id,
        name: '测试商家店铺',
        address: '固始县测试地址',
        phone: '99999999999',
        latitude: 115.66352,
        longitude: 32.16821,
        status: 1
      });
    }
    console.log(`✅ 使用商家: ID=${merchant.id}, 名称=${merchant.name}`);

    let testUser = await User.findOne({ where: { role: 'user' } });
    if (!testUser) {
      console.log('⚠️ 没有普通用户，创建一个测试用户...');
      testUser = await User.create({
        phone: '18888888888',
        password: '123456',
        nickname: '测试用户',
        role: 'user',
        status: 1
      });
    }
    console.log(`✅ 使用用户: ID=${testUser.id}, 昵称=${testUser.nickname}`);

    const testOrders = [
      {
        order_no: `TEST${Date.now()}001`,
        delivery_longitude: 115.65158,
        delivery_latitude: 32.18683,
        delivery_address: JSON.stringify({
          province: '河南省',
          city: '信阳市',
          district: '固始县',
          street: '番城街道办事处',
          detail: '固始县番城街道办事处'
        }),
        contact_name: '测试客户1',
        contact_phone: '13900000001'
      },
      {
        order_no: `TEST${Date.now()}002`,
        delivery_longitude: 115.67055,
        delivery_latitude: 32.15566,
        delivery_address: JSON.stringify({
          province: '河南省',
          city: '信阳市',
          district: '固始县',
          street: '秀水公园南门',
          detail: '固始县秀水公园南门'
        }),
        contact_name: '测试客户2',
        contact_phone: '13900000002'
      }
    ];

    const createdOrders = [];
    
    for (const orderData of testOrders) {
      const order = await Order.create({
        order_no: orderData.order_no,
        user_id: testUser.id,
        merchant_id: merchant.id,
        rider_id: rider.id,
        type: 'takeout',
        order_type: 'county',
        status: 5,
        products_info: JSON.stringify([
          { name: '测试商品', quantity: 1, price: 20 }
        ]),
        total_amount: 20.00,
        delivery_fee: 3.00,
        package_fee: 1.00,
        pay_amount: 24.00,
        rider_fee: 3.00,
        delivery_type: 1,
        contact_phone: orderData.contact_phone,
        contact_name: orderData.contact_name,
        delivery_address: orderData.delivery_address,
        delivery_latitude: orderData.delivery_latitude,
        delivery_longitude: orderData.delivery_longitude,
        paid_at: new Date(),
        payment_channel: 'mock'
      });
      
      createdOrders.push(order);
      console.log(`\n✅ 订单创建成功:`);
      console.log(`   订单号: ${order.order_no}`);
      console.log(`   订单ID: ${order.id}`);
      console.log(`   骑手ID: ${order.rider_id}`);
      console.log(`   状态: ${order.status} (配送中)`);
      console.log(`   配送地址: ${orderData.delivery_address}`);
      console.log(`   经度: ${order.delivery_longitude}, 纬度: ${order.delivery_latitude}`);
    }

    console.log('\n========================================');
    console.log('🎉 测试订单插入完成！');
    console.log(`共插入 ${createdOrders.length} 条订单`);
    console.log(`骑手ID: ${rider.id}`);
    console.log('现在可以刷新前端页面查看订单了！');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ 操作失败:', error);
    process.exit(1);
  }
}

insertTestOrders();
