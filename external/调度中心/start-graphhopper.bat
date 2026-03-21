@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════╗
echo ║                                                ║
echo ║     GraphHopper 本地部署启动脚本                 ║
echo ║                                                ║
echo ╚════════════════════════════════════════════════╝
echo.

echo 📋 检查 Docker 环境...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker 未安装或未启动！
    echo 💡 请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo ✅ Docker 环境正常
echo.

echo 📂 检查必要文件...
if not exist "docker-compose.yml" (
    echo ❌ docker-compose.yml 文件不存在！
    pause
    exit /b 1
)
if not exist "graphhopper-config.yml" (
    echo ❌ graphhopper-config.yml 文件不存在！
    pause
    exit /b 1
)
echo ✅ 配置文件存在
echo.

echo 📥 下载中国地图数据（如果不存在）...
if not exist "graphhopper-data\china-latest.osm.pbf" (
    echo ⏳ 正在下载中国地图数据，这可能需要几分钟...
    echo 💡 文件大小约 1.5GB，请耐心等待...
    
    if not exist "graphhopper-data" mkdir graphhopper-data
    
    curl -L -o graphhopper-data\china-latest.osm.pbf https://download.geofabrik.de/asia/china-latest.osm.pbf
    
    if %errorlevel% neq 0 (
        echo ❌ 地图数据下载失败！
        echo 💡 请手动下载并放置到 graphhopper-data\china-latest.osm.pbf
        echo 💡 下载地址: https://download.geofabrik.de/asia/china-latest.osm.pbf
        pause
        exit /b 1
    )
    
    echo ✅ 地图数据下载完成
) else (
    echo ✅ 地图数据已存在
)
echo.

echo 🚀 启动 GraphHopper 服务...
docker-compose up -d

if %errorlevel% neq 0 (
    echo ❌ GraphHopper 启动失败！
    pause
    exit /b 1
)

echo.
echo ✅ GraphHopper 服务启动成功！
echo.
echo 📊 服务信息:
echo    - 服务地址: http://localhost:8989
echo    - API 文档: http://localhost:8989/
echo    - 健康检查: http://localhost:8989/health
echo.
echo ⏳ 等待服务初始化（首次启动需要 5-10 分钟）...
echo 💡 请等待地图数据加载完成后再进行测试
echo.

echo 📝 查看日志命令: docker-compose logs -f graphhopper
echo 🛑 停止服务命令: docker-compose down
echo.

pause
