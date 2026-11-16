# 我的任务

一个使用 Tauri 2、原生 JavaScript、Frappe Gantt 和 SQLite 构建的单机任务管理应用。

应用没有账号、登录、角色或权限系统。任务只保存在当前电脑，不连接网络服务。

## 功能

- 新建、编辑和删除任务
- 为任务设置完成、未完成、延期或搁置状态
- 设置开始日期、结束日期、进度、前置任务和备注
- 拖动任务调整日期，拖动进度手柄修改完成度
- 修改后自动保存
- 关闭并重新打开应用后继续显示任务

## 开发

环境要求：

- Node.js 20 或更高版本
- Rust 稳定版
- Windows WebView2 与 C++ 构建工具

```powershell
npm install
npm run tauri dev
```

## 验证

```powershell
npm test
cd src-tauri
cargo test
cd ..
npm run build
```

## 构建 Windows 安装包

```powershell
npm run tauri build
```

安装包输出到 `src-tauri/target/release/bundle/nsis/`。

## 数据位置

SQLite 文件位于 Tauri 的应用数据目录。在当前 Windows 环境中为：

```text
%APPDATA%\com.local.taskmanager\tasks.db
```

复制该文件即可备份全部任务。升级应用不会覆盖这个数据库文件。

数据库保持宽松结构，不包含用户、权限、角色、外键或严格检查约束。
