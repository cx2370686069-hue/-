const { sequelize, User, Merchant, Product } = require('../models');

async function initData() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 1. 创建测试商家账号 (用于登录)
    const [testUser] = await User.findOrCreate({
      where: { phone: '13800000000' },
      defaults: {
        password: 'password123',
        role: 'merchant',
        nickname: '沙县小吃老板'
      }
    });
    console.log('✅ 测试商家账号生成: 13800000000 / password123');

    // 2. 创建商家店铺信息
    const [testMerchant] = await Merchant.findOrCreate({
      where: { phone: '13800000000' },
      defaults: {
        user_id: testUser.id,
        name: '沙县小吃（固始店）',
        address: '固始县秀水街道',
        longitude: 115.68,
        latitude: 32.18,
        status: 1
      }
    });
    console.log('✅ 测试商家店铺生成');

    // 3. 为该商家创建测试商品
    const productCount = await Product.count({ where: { merchant_id: testMerchant.id } });
    if (productCount === 0) {
      await Product.bulkCreate([
        { merchant_id: testMerchant.id, name: '鸭腿饭', price: 15.00, stock: 100, status: 1, image: 'https://via.placeholder.com/150' },
        { merchant_id: testMerchant.id, name: '飘香拌面', price: 8.00, stock: 100, status: 1, image: 'https://via.placeholder.com/150' },
        { merchant_id: testMerchant.id, name: '乌鸡汤', price: 12.00, stock: 100, status: 1, image: 'https://via.placeholder.com/150' }
      ]);
      console.log('✅ 测试商品生成');
    } else {
        console.log('✅ 测试商品已存在，跳过生成');
    }

    console.log('🎉 所有测试数据初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化数据失败:', error);
    process.exit(1);
  }
}

initData();