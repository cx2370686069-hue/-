module.exports = {
  apps: [
    {
      name: 'gushi-waimai-backend', // 服务名称
      script: './src/index.js',      // 启动入口文件
      instances: 1,                  // 实例数量，单机部署先用 1
      autorestart: true,             // 崩溃自动重启（上云必备防宕机）
      watch: false,                  // 生产环境不监听文件变化
      max_memory_restart: '500M',    // 内存超 500M 自动重启防溢出
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 这里可以覆盖 .env 中的变量
        // CORS_ORIGIN: '*'
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z', // 日志时间格式
      error_file: './logs/error.log',        // 错误日志文件路径
      out_file: './logs/out.log'             // 标准输出日志文件路径
    }
  ]
};
