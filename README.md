# VibeShell

基于 [Tauri 2](https://v2.tauri.app) 开发的跨平台 SSH 终端客户端，一站式整合远程终端会话、服务器实时监控和 SFTP 文件管理功能。

## 功能特性

- **SSH 终端** — 支持密码认证、密钥认证（OpenSSH / PEM 格式）和 ssh-agent 连接远程服务器
- **多标签页** — 多会话标签页管理，支持快速切换和标签排序
- **主机管理** — 标签系统管理服务器，保存连接凭据，支持搜索和快速连接
- **SFTP 文件管理** — 浏览、上传、下载、拖拽上传、在线编辑、重命名、权限修改和递归操作
- **服务器监控** — 实时 CPU、内存、磁盘占用和进程概览，带历史趋势折线图
- **密钥链** — 导入和管理 SSH 私钥，支持密码短语验证
- **自动重连** — 指数退避重连策略，可配置最大重试次数和延迟
- **主题切换** — 深色和浅色模式，多种终端配色方案（GitHub Dark、Dracula 等）
- **国际化** — 支持简体中文和英文界面，自动跟随系统语言
- **数据备份** — 导出/恢复主机配置和密钥数据（JSON 格式）

## 下载

预编译安装包请前往 [Releases](https://github.com/chihqiang/VibeShell/releases) 页面下载。

| 平台 | 架构 | 格式 |
|------|------|------|
| macOS | Intel & ARM | .dmg |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建安装包
npm run tauri build
```

启动后：

1. 点击 **添加主机** 保存服务器连接信息，或使用顶栏 **快速连接** 输入地址
2. 双击主机或回车即可打开终端会话
3. 连接后点击右侧按钮打开 **监控面板** 查看实时服务器状态
4. 在终端标签页底部可展开 **SFTP 面板** 管理远程文件

## 常见问题

### macOS 提示 "VibeShell"已损坏，无法打开。你应该将它移到废纸篓。

这是 macOS Gatekeeper 安全机制的常见提示，并非应用本身损坏。VibeShell 目前未通过 Apple Notarization 公证，因此首次打开时可能被系统拦截。

**解决方法：**

1. **通过系统设置允许打开（推荐）**
   - 打开 **系统设置 → 隐私与安全性**
   - 向下滚动，在"安全性"部分找到关于 VibeShell 的提示
   - 点击 **仍要打开** 按钮
   - 输入管理员密码确认

2. **使用命令行移除隔离属性**
   ```bash
   # 将 .app 拖入终端，或手动指定路径
   sudo xattr -d com.apple.quarantine /Applications/VibeShell.app
   ```
   执行后重新打开应用即可。

3. **临时关闭 Gatekeeper（不推荐）**
   ```bash
   sudo spctl --master-disable
   ```
   操作完成后记得重新开启：`sudo spctl --master-enable`。

> **注意：** 应用本身是安全的，所有源码均在 GitHub 开源。如仍有疑问，可在 [Issues](https://github.com/chihqiang/VibeShell/issues) 中反馈。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri 2](https://v2.tauri.app) |
| 前端框架 | React 19 + TypeScript 5.8 |
| 构建工具 | Vite 7 + Tailwind CSS 4 |
| 终端 | [xterm.js](https://xtermjs.org/) |
| 图表 | [Recharts](https://recharts.org/) |
| 路由 | react-router-dom 7 |
| 国际化 | i18next |
| 后端语言 | Rust (edition 2021) |
| SSH 库 | [ssh2](https://github.com/alexcrichton/ssh2-rs) (libssh2) |
| 数据库 | SQLite (rusqlite) |

## 贡献指南

欢迎提交 Pull Request 或创建 Issue。

### 开发环境

- Node.js 20+
- Rust 1.85+
- npm 10.8+

### 开发流程

1. Fork 本仓库并克隆到本地
2. 运行 `npm install` 安装依赖
3. 创建功能分支：`git checkout -b feature/xxx`
4. 开发完成后提交代码
5. 推送到远程并创建 Pull Request

### 代码规范

- 前端：遵循 ESLint 和 Prettier 配置
- 后端：遵循 `cargo fmt` 格式化
- i18n：修改语言文件后运行 `npm run check:i18n` 验证键一致性

```bash
# 一键检查（格式化、lint、i18n、编译）
npm run check
```

## 许可证

[Apache 2.0](LICENSE)
