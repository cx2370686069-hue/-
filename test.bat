@echo off
echo ====================================
echo   跑腿后端 - 快速测试接口脚本
echo ====================================
echo.

echo [1] 测试健康检查接口...
curl -X GET http://localhost:3000/api/health
echo.
echo.

echo [2] 注册一个普通用户...
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138000\",\"password\":\"123456\",\"nickname\":\"测试用户\"}"
echo.
echo.

echo [3] 用户登录...
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138000\",\"password\":\"123456\"}"
echo.
echo.

echo [4] 注册一个商家...
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138001\",\"password\":\"123456\",\"nickname\":\"商家测试\",\"role\":\"merchant\"}"
echo.
echo.

echo [5] 注册一个骑手...
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138002\",\"password\":\"123456\",\"nickname\":\"骑手测试\",\"role\":\"rider\"}"
echo.
echo.

echo 测试完成！按任意键退出...
pause > nul
