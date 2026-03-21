# 阿里云服务器部署指南

## 项目概述

本项目是外卖拼单系统的导航和地图测试项目，专门用于测试天地图和GraphHopper的路径规划功能。

## 部署架构

```
阿里云服务器 (Ubuntu 20.04 / CentOS 7+)
├── 后端服务 (Express + SQLite)
│   └── 端口: 3000
├── GraphHopper 服务 (Docker)
│   └── 端口: 8989
└── 天地图 API (通过后端代理调用)
    └── 无需额外端口
```

## 部署步骤

### 第一步：服务器准备

#### 1.1 购买ECS服务器

**推荐配置：**
- CPU: 2核或更高
- 内存: 4GB或更高
- 操作系统: Ubuntu 20.04 / CentOS 7+
- 带宽: 3-5Mbps

#### 1.2 安装必要软件

**Ubuntu:**
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (Node 18.x)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装 Git
sudo apt install -y git

# 安装 Nginx (可选，用于反向代理)
sudo apt install -y nginx
```

**CentOS:**
```bash
# 更新系统
sudo yum update -y

# 安装 Node.js (Node 18.x)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装 Git
sudo yum install -y git

# 安装 Nginx (可选)
sudo yum install -y nginx
```

#### 1.3 开放防火墙端口

**Ubuntu (ufw):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # 后端API
sudo ufw allow 8989/tcp  # GraphHopper
sudo ufw enable
```

**CentOS (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8989/tcp
sudo firewall-cmd --reload
```

**阿里云安全组配置：**
- 在阿里云控制台配置安全组，开放上述端口

### 第二步：部署后端服务

#### 2.1 上传代码到服务器

**方式1：使用 Git（推荐）**
```bash
# 克隆项目（如果有Git仓库）
cd /opt
sudo git clone <your-repo-url> delivery-map-test
cd delivery-map-test/04-backend
```

**方式2：手动上传**
```bash
# 在本地打包项目
cd d:\外卖拼单实验
tar -czf delivery-map-test.tar.gz 04-backend graphhopper-data docker-compose.yml graphhopper-config.yml

# 上传到服务器
scp delivery-map-test.tar.gz root@your-server-ip:/opt/

# 在服务器上解压
ssh root@your-server-ip
cd /opt
tar -xzf delivery-map-test.tar.gz
cd 04-backend
```

#### 2.2 安装依赖

```bash
cd /opt/delivery-map-test/04-backend
npm install --production
```

#### 2.3 配置环境变量（可选）

```bash
# 创建 .env 文件
cat > .env << EOF
PORT=3000
NODE_ENV=production
GRAPHHOPPER_URL=http://localhost:8989
EOF
```

#### 2.4 使用 PM2 管理后端服务

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动后端服务
pm2 start server.js --name "delivery-backend"

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs delivery-backend

# 查看状态
pm2 status
```

### 第三步：部署 GraphHopper

#### 3.1 上传地图数据

```bash
cd /opt/delivery-map-test

# 如果没有地图数据，下载中国地图
mkdir -p graphhopper-data
cd graphhopper-data

# 下载中国地图数据（约1.5GB）
wget https://download.geofabrik.de/asia/china-latest.osm.pbf

# 或者下载河南地图（更小，约100MB）
wget https://download.geofabrik.de/asia/china/henan-latest.osm.pbf

cd ..
```

#### 3.2 配置 GraphHopper

检查 `graphhopper-config.yml` 配置：

```yaml
server:
  min_request_interval_seconds: 0
  data_repository: data-repository

graphhopper:
  datareader.file: graphhopper-data/china-latest.osm.pbf
  graph.location: graphhopper-data/graph-cache
  profiles:
    - name: car
      vehicle: car
      weighting: fastest
    - name: bike
      vehicle: bike
      weighting: fastest
    - name: foot
      vehicle: foot
      weighting: fastest
  storage: memory
```

#### 3.3 启动 GraphHopper

```bash
cd /opt/delivery-map-test

# 启动 GraphHopper
docker-compose up -d

# 查看日志
docker-compose logs -f graphhopper

# 等待地图数据加载完成（首次启动需要5-10分钟）
```

### 第四步：服务器端测试

#### 4.1 运行集成测试

```bash
cd /opt/delivery-map-test/04-backend

# 运行完整测试
node test-server-integration.js

# 如果后端或GraphHopper不在默认端口，使用环境变量
BACKEND_URL=http://localhost:3000 GRAPHHOPPER_URL=http://localhost:8989 node test-server-integration.js

# 测试远程服务器
BACKEND_URL=http://your-server-ip:3000 GRAPHHOPPER_URL=http://your-server-ip:8989 node test-server-integration.js
```

#### 4.2 单独测试各项功能

```bash
# 测试后端健康检查
curl http://localhost:3000/api/health

# 测试 GraphHopper 健康检查
curl http://localhost:8989/health

# 测试天地图路线规划
curl -X POST http://localhost:3000/api/tianditu/drive \
  -H "Content-Type: application/json" \
  -d '{"orig":"115.654,32.168","dest":"115.664,32.178","style":"0"}'

# 测试 GraphHopper 路线规划
curl -X POST http://localhost:3000/api/graphhopper/route \
  -H "Content-Type: application/json" \
  -d '{"points":[[115.654,32.168],[115.664,32.178]],"profile":"car","locale":"zh-CN"}'
```

### 第五步：配置 Nginx 反向代理（可选）

#### 5.1 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/delivery-map
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或服务器IP

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # GraphHopper API
    location /graphhopper/ {
        proxy_pass http://localhost:8989/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 前端页面（可选）
    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5.2 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/delivery-map /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 第六步：配置 SSL 证书（可选）

#### 6.1 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx  # Ubuntu
# sudo yum install -y certbot python3-certbot-nginx  # CentOS

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 常用管理命令

### 后端服务（PM2）

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs delivery-backend

# 重启服务
pm2 restart delivery-backend

# 停止服务
pm2 stop delivery-backend

# 删除服务
pm2 delete delivery-backend

# 监控
pm2 monit
```

### GraphHopper（Docker）

```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f graphhopper

# 重启服务
docker-compose restart graphhopper

# 停止服务
docker-compose down

# 启动服务
docker-compose up -d

# 更新 GraphHopper
docker-compose pull
docker-compose up -d
```

### 系统监控

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看端口占用
netstat -tlnp
# 或
ss -tlnp
```

## 故障排查

### 后端服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep 3000

# 查看详细日志
pm2 logs delivery-backend --lines 100

# 检查依赖
npm list

# 重新安装依赖
rm -rf node_modules
npm install
```

### GraphHopper 无法启动

```bash
# 检查 Docker 状态
docker ps -a

# 查看 GraphHopper 日志
docker-compose logs graphhopper

# 检查地图数据
ls -lh graphhopper-data/

# 重启 Docker
sudo systemctl restart docker
```

### 天地图 API 调用失败

```bash
# 检查网络连接
curl -I https://api.tianditu.gov.cn

# 检查后端代理
curl http://localhost:3000/api/tianditu/myip

# 查看后端日志
pm2 logs delivery-backend
```

## 性能优化

### 后端优化

```bash
# 启用 Node.js 集群模式
pm2 start server.js --name "delivery-backend" -i max

# 增加内存限制
pm2 start server.js --name "delivery-backend" --max-memory-restart 1G
```

### GraphHopper 优化

修改 `graphhopper-config.yml`：

```yaml
graphhopper:
  # 使用磁盘存储（节省内存）
  storage: mmap
  
  # 限制加载的地图区域（可选）
  datareader.file: graphhopper-data/henan-latest.osm.pbf
  
  # 启用缓存
  prepare.threads: 4
```

### Nginx 优化

```nginx
# 启用 gzip 压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
```

## 备份与恢复

### 备份数据库

```bash
# 备份 SQLite 数据库
cp database/gushi_delivery.db database/gushi_delivery.db.backup.$(date +%Y%m%d)

# 自动备份脚本
cat > /opt/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /opt/delivery-map-test/04-backend/database/gushi_delivery.db $BACKUP_DIR/gushi_delivery.db.$DATE
# 保留最近7天的备份
find $BACKUP_DIR -name "gushi_delivery.db.*" -mtime +7 -delete
EOF

chmod +x /opt/backup-db.sh

# 添加到 crontab（每天凌晨2点备份）
crontab -e
# 添加: 0 2 * * * /opt/backup-db.sh
```

### 恢复数据库

```bash
# 停止服务
pm2 stop delivery-backend

# 恢复数据库
cp /opt/backups/gushi_delivery.db.20240101_020000 /opt/delivery-map-test/04-backend/database/gushi_delivery.db

# 重启服务
pm2 start delivery-backend
```

## 安全建议

1. **修改默认端口**：避免使用默认端口
2. **配置防火墙**：只开放必要的端口
3. **使用 HTTPS**：配置 SSL 证书
4. **定期更新**：保持系统和依赖包更新
5. **监控日志**：定期检查系统日志
6. **备份数据**：定期备份数据库和配置文件
7. **限制访问**：使用 IP 白名单或 VPN

## 联系支持

如有问题，请查看：
- 项目文档：README.md
- GraphHopper 文档：https://docs.graphhopper.com/
- 天地图文档：http://lbs.tianditu.gov.cn/home.html
