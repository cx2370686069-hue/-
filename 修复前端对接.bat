@echo off
chcp 65001 >nul
echo ========================================
echo    前后端对接修复脚本
echo ========================================
echo.

echo [1/2] 正在修复用户端 request.js ...
(
echo /**
echo  * 统一请求封装
echo  * - 自动带上 token
echo  * - 统一错误处理
echo  * - 后端地址集中配置
echo  */
echo.
echo import { BASE_URL } from '../config/index.js'
echo.
echo const API_BASE_URL = BASE_URL + '/api'
echo.
echo export function request(url, method = "GET", data = {}) {
echo   return new Promise((resolve, reject) =^> {
echo     const token = uni.getStorageSync("token") ^|^| ""
echo.
echo     uni.request({
echo       url: API_BASE_URL + url,
echo       method: method,
echo       data: data,
echo       header: {
echo         "Content-Type": "application/json",
echo         "Authorization": token ? "Bearer " + token : ""
echo       },
echo       success: (res) =^> {
echo         if (res.statusCode === 401) {
echo           uni.showToast({ title: "请先登录", icon: "none" })
echo           setTimeout(() =^> {
echo             uni.navigateTo({ url: "/pages/login/index" })
echo           }, 1000)
echo           reject({ code: 401, msg: "请先登录" })
echo           return
echo         }
echo         if (res.statusCode === 200) {
echo           resolve(res.data)
echo         } else {
echo           const msg = res.data.msg ^|^| res.data.message ^|^| res.data.detail ^|^| "请求失败"
echo           uni.showToast({ title: msg, icon: "none" })
echo           reject({ code: res.statusCode, msg: msg })
echo         }
echo       },
echo       fail: (err) =^> {
echo         uni.showToast({ title: "网络错误，请检查后端是否启动", icon: "none" })
echo         reject({ code: 500, msg: "网络错误" })
echo       }
echo     })
echo   })
echo }
echo.
echo export function get(url) {
echo   return request(url, "GET")
echo }
echo.
echo export function post(url, data) {
echo   return request(url, "POST", data)
echo }
echo.
echo export function put(url, data) {
echo   return request(url, "PUT", data)
echo }
echo.
echo export function del(url, data) {
echo   return request(url, "DELETE", data)
echo }
) > "E:\固始县外卖前端\utils\request.js"

if %errorlevel% equ 0 (
    echo     √ 用户端修复成功！
) else (
    echo     × 用户端修复失败，请手动复制
)

echo.
echo [2/2] 正在修复商家端 request.js ...
(
echo /**
echo  * 网络请求封装
echo  */
echo.
echo import { BASE_URL } from '../config/index.js';
echo.
echo const API_BASE_URL = BASE_URL + '/api';
echo.
echo function request(options) {
echo   return new Promise((resolve, reject) =^> {
echo     const token = uni.getStorageSync('token') ^|^| '';
echo.
echo     uni.request({
echo       url: API_BASE_URL + options.url,
echo       method: options.method ^|^| 'GET',
echo       data: options.data ^|^| {},
echo       header: {
echo         'Content-Type': 'application/json',
echo         'Authorization': token ? "Bearer " + token : ''
echo       },
echo       success: (res) =^> {
echo         if (res.statusCode === 401) {
echo           uni.removeStorageSync('token');
echo           uni.showToast({ title: '未登录，部分数据为演示', icon: 'none' });
echo           reject(res.data);
echo           return;
echo         }
echo         if (res.statusCode === 200) {
echo           resolve(res.data);
echo         } else {
echo           const msg = res.data.detail ^|^| res.data.message ^|^| res.data.msg ^|^| '请求失败';
echo           uni.showToast({ title: msg, icon: 'none' });
echo           reject(res.data);
echo         }
echo       },
echo       fail: () =^> {
echo         uni.showToast({ title: '网络错误，请检查后端是否启动', icon: 'none' });
echo         reject({ message: '网络错误' });
echo       }
echo     });
echo   });
echo }
echo.
echo export default request;
) > "E:\固始县外卖商家端\utils\request.js"

if %errorlevel% equ 0 (
    echo     √ 商家端修复成功！
) else (
    echo     × 商家端修复失败，请手动复制
)

echo.
echo ========================================
echo    修复完成！
echo ========================================
echo.
echo 修复内容：
echo   1. 用户端：统一BASE_URL配置 + 添加/api前缀
echo   2. 商家端：修正认证头格式为 Bearer token
echo.
echo 骑手端无需修改，配置已正确。
echo.
pause
