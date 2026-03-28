
const { User } = require('../models');

async function createRider() {
  try {
    const phone = '13800138000';
    const password = '123456';
    
    // 检查是否已存在
    const existingUser = await User.findOne({ where: { phone } });
    
    if (existingUser) {
      console.log('⚠️ 该手机号已存在，正在尝试更新为骑手账号...');
      await existingUser.update({
        nickname: '测试骑手',
        role: 'rider',
        status: 1,
        rider_status: 1,
        password: password // 会触发 beforeUpdate 钩子加密
      });
      console.log('✅ 账号更新成功！');
    } else {
      await User.create({
        phone,
        password, // 会触发 beforeCreate 钩子加密
        nickname: '测试骑手',
        role: 'rider',
        status: 1,
        rider_status: 1,
        rider_kind: 'rider'
      });
      console.log('✅ 骑手账号创建成功！');
    }
    
    console.log('\n-----------------------------');
    console.log('账号信息：');
    console.log(`手机号: ${phone}`);
    console.log(`密码: ${password}`);
    console.log('角色: 骑手 (rider)');
    console.log('状态: 正常');
    console.log('接单状态: 已开启 (接单中)');
    console.log('-----------------------------\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 操作失败:', error);
    process.exit(1);
  }
}

createRider();
