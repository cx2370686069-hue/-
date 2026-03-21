# Docker Desktop 安装详细步骤

## 📥 下载 Docker Desktop

1. **访问下载页面**
   - 打开浏览器，访问：https://www.docker.com/products/docker-desktop

2. **选择版本**
   - 点击 "Download for Windows"
   - 选择 **Windows with AMD64 chip**
   - 下载文件：`Docker Desktop Installer.exe`

## 🚀 安装步骤

### 第 1 步：运行安装程序

1. **双击运行** `Docker Desktop Installer.exe`
2. **等待解压完成**
   - 会自动解压安装文件
   - 等待出现安装向导

### 第 2 步：安装向导 - 欢迎页面

1. 点击 **"OK"** 按钮
2. 等待安装程序启动

### 第 3 步：安装向导 - 配置选项

**重要：按以下方式勾选**

#### ✅ 必须勾选的选项：

1. **"Use WSL 2 instead of Hyper-V"**（推荐）
   - ☑️ **勾选此项**
   - 说明：使用 WSL 2 而不是 Hyper-V
   - 原因：性能更好，兼容性更强

2. **"Add shortcut to desktop"**（可选）
   - ☑️ **勾选此项**
   - 说明：在桌面创建快捷方式
   - 方便后续启动 Docker

#### ❌ 不需要勾选的选项：

- **"Install Docker Compose"** - 已包含在安装包中
- **"Install Kubernetes"** - 不需要，取消勾选
- **"Install VirtualBox"** - 不需要，取消勾选

### 第 4 步：安装向导 - 确认安装

1. 点击 **"OK"** 或 **"Install"** 按钮
2. 等待安装完成
3. 安装过程可能需要 5-10 分钟

### 第 5 步：安装向导 - 安装完成

1. 看到 **"Installation successful"** 提示
2. 点击 **"Close and restart"** 按钮
3. 系统会自动重启

## 🔧 首次启动配置

### 第 6 步：重启后首次启动

1. **启动 Docker Desktop**
   - 从桌面快捷方式启动
   - 或从开始菜单启动

2. **接受服务协议**
   - 点击 **"Accept"** 按钮
   - 接受 Docker 服务协议

3. **登录账号（可选）**
   - 可以点击 **"Skip"** 跳过登录
   - 或注册 Docker Hub 账号后登录

4. **等待 Docker 启动**
   - 看到 Docker 图标变为绿色
   - 状态显示 "Docker Desktop is running"

### 第 7 步：WSL 2 配置（如果提示）

如果提示启用 WSL 2：

1. **点击提示中的链接**
   - 会打开 Microsoft Store
   - 下载并安装 WSL 2

2. **或者手动安装 WSL 2**
   - 打开 PowerShell（管理员）
   - 运行命令：`wsl --install`
   - 按照提示完成安装

3. **重启电脑**

## ✅ 验证安装

### 方法 1：检查 Docker 版本

1. 打开 **PowerShell**
2. 运行命令：
   ```bash
   docker --version
   ```
3. 应该显示类似：
   ```
   Docker version 24.x.x, build xxxxx
   ```

### 方法 2：检查 Docker 运行状态

1. 运行命令：
   ```bash
   docker ps
   ```
2. 如果没有错误，说明 Docker 正常运行

### 方法 3：测试运行容器

1. 运行命令：
   ```bash
   docker run hello-world
   ```
2. 应该看到：
   ```
   Hello from Docker!
   This message shows that your installation appears to be working correctly.
   ```

## ⚙️ Docker Desktop 设置

### 推荐配置

1. **打开设置**
   - 右键点击任务栏 Docker 图标
   - 选择 **"Settings"**

2. **Resources 设置**
   - **Memory**: 至少 4GB（推荐 8GB）
   - **CPUs**: 至少 2 核（推荐 4 核）
   - **Disk**: 至少 50GB

3. **WSL 2 集成**
   - 确保已启用 WSL 2
   - 在 **General** 选项卡中勾选 **"Use WSL 2 based engine"**

## 🚨 常见问题

### 问题 1：提示启用虚拟化

**解决方法**：
1. 重启电脑
2. 进入 BIOS（按 F2/Del/F12）
3. 找到 **Virtualization Technology (VT-x)**
4. 设置为 **Enabled**
5. 保存并重启

### 问题 2：WSL 2 安装失败

**解决方法**：
1. 确保使用 Windows 10/11
2. 更新 Windows 到最新版本
3. 在 PowerShell（管理员）运行：
   ```bash
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   ```

### 问题 3：Docker 启动失败

**解决方法**：
1. 检查 Windows 功能是否启用
   - 控制面板 → 程序和功能
   - 启用 **"适用于 Linux 的 Windows 子系统"**
   - 启用 **"虚拟机平台"**
2. 重启电脑
3. 重新启动 Docker Desktop

## 📝 安装完成检查清单

- [ ] Docker Desktop 已下载（AMD64 版本）
- [ ] 安装程序已运行
- [ ] "Use WSL 2 instead of Hyper-V" 已勾选
- [ ] "Add shortcut to desktop" 已勾选
- [ ] 安装完成并重启
- [ ] Docker Desktop 已启动
- [ ] `docker --version` 命令正常
- [ ] `docker run hello-world` 测试成功

## 🎯 安装后的下一步

安装完成后，启动 GraphHopper 服务：

```bash
cd d:\外卖拼单实验
双击运行: start-graphhopper.bat
```

等待 5-10 分钟让服务初始化，然后运行测试：

```bash
cd d:\外卖拼单实验\04-backend
node test-backend-proxy.js
```

---

**祝安装顺利！如有问题请随时询问。** 🎉
