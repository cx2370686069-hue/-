require('dotenv').config();

const { sequelize, User } = require('../models');

const run = async () => {
  const phone = String(process.env.ADMIN_PHONE || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  const nickname = String(process.env.ADMIN_NICKNAME || '后台管理员').trim();

  if (!phone || !password) {
    throw new Error('请先在 .env 中配置 ADMIN_PHONE 和 ADMIN_PASSWORD');
  }

  await sequelize.authenticate();

  const existingUser = await User.findOne({ where: { phone } });

  if (existingUser && existingUser.role !== 'admin') {
    throw new Error(`手机号 ${phone} 已被 ${existingUser.role} 角色占用，请更换管理员手机号`);
  }

  if (existingUser) {
    existingUser.nickname = nickname || existingUser.nickname;
    existingUser.password = password;
    existingUser.status = 1;
    existingUser.role = 'admin';
    await existingUser.save();

    console.log(`✅ 管理员账号已更新：${phone}`);
    return;
  }

  await User.create({
    phone,
    password,
    nickname,
    role: 'admin',
    status: 1
  });

  console.log(`✅ 管理员账号创建成功：${phone}`);
};

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ 初始化管理员失败：', error.message);
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error('关闭数据库连接失败：', closeError.message);
    }
    process.exit(1);
  });
