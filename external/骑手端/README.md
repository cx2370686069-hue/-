# 固始县外卖骑手端

## 项目简介

固始县外卖骑手专用 APP，用于骑手接单、配送、收入管理等功能。

## 技术栈

- **框架**: uni-app + Vue 3
- **支持平台**: 微信小程序、H5、App
- **后端接口**: Node.js + Express + MySQL

## 项目结构

```
固始县外卖骑手端/
├── api/              # API 接口
│   ├── auth.js      # 认证相关
│   ├── order.js     # 订单相关
│   ├── errand.js    # 跑腿订单
│   └── user.js      # 用户相关
├── config/           # 配置文件
│   └── index.js     # 全局配置
├── pages/            # 页面
│   ├── index/       # 工作台首页
│   ├── orders/      # 外卖订单
│   ├── errands/     # 跑腿订单
│   ├── earnings/    # 收入明细
│   ├── profile/     # 个人中心
│   └── login/       # 登录注册
├── utils/            # 工具函数
│   ├── request.js   # 请求封装
│   ├── storage.js   # 本地存储
│   └── index.js     # 通用工具
├── static/           # 静态资源
├── App.vue          # 应用配置
├── main.js          # 入口文件
├── pages.json       # 页面配置
└── manifest.json    # 应用配置
```

## 快速开始

### 1. 安装 HBuilderX

下载并安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)

### 2. 导入项目

- 打开 HBuilderX
- 文件 -> 导入 -> 从本地目录导入
- 选择本项目目录

### 3. 配置后端地址

修改 `config/index.js` 中的 `BASE_URL`：

```javascript
BASE_URL: 'http://你的后端地址：3000'
```

### 4. 运行项目

- 微信小程序：运行 -> 运行到小程序模拟器 -> 微信开发者工具
- H5：运行 -> 运行到浏览器
- App：运行 -> 运行到手机或模拟器

## 功能列表

### 已实现功能 ✅

- [x] 骑手登录/注册
- [x] 工作台首页
- [x] 在线/休息状态切换
- [x] 数据统计（今日完成、配送中、收入）
- [x] 外卖订单列表
- [x] 订单详情
- [x] 抢单/接单
- [x] 确认送达
- [x] 个人中心
- [x] 退出登录

### 待实现功能 ⏳

- [ ] 跑腿订单列表
- [ ] 跑腿订单详情
- [ ] 收入明细
- [ ] 余额提现
- [ ] 修改密码
- [ ] 联系客服
- [ ] 订单导航
- [ ] 通话记录
- [ ] 数据统计图表

## 后端 API 文档

后端接口文档请查看后端项目的 `API_DOC.md` 文件。

### 主要接口

- 登录：`POST /api/auth/login`
- 注册：`POST /api/auth/register`
- 获取可抢订单：`GET /api/order/available`
- 抢单：`POST /api/order/rider-accept`
- 确认送达：`POST /api/order/confirm-delivery`
- 获取我的订单：`GET /api/order/rider-orders`
- 更新骑手状态：`POST /api/order/rider-status`

## 注意事项

1. **后端地址配置**：手机调试时需要将 `localhost` 改成电脑的局域网 IP
2. **骑手角色**：注册时需要选择 `role: 'rider'`
3. **定位权限**：需要在 manifest.json 中配置定位权限
4. **电话拨打**：需要在 manifest.json 中配置电话权限

## 开发规范

- 使用 Vue 3 Composition API
- 统一使用 `uni.request` 封装的请求方法
- 错误统一处理，显示 toast 提示
- 代码缩进 2 空格
- 组件名使用 kebab-case

## 常见问题

### Q: 无法连接后端？
A: 检查后端是否启动，地址是否正确。手机调试需要用局域网 IP。

### Q: 登录后跳转失败？
A: 检查 token 是否正确保存，用户角色是否为 rider。

### Q: 订单列表为空？
A: 检查后端是否有待接单的订单，订单状态是否正确。

## 更新日志

### v1.0.0 (2026-03-13)
- 初始版本发布
- 实现基础接单配送功能
- 工作台首页
- 订单管理

## 联系方式

如有问题，请联系项目管理员。
