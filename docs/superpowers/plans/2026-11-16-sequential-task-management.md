# 时序任务管理实施计划

> **执行说明：** 本计划使用测试驱动方式逐步实现，并在每个阶段运行对应验证命令。

**目标：** 构建基于 Tauri 2 和 SQLite 的单窗口项目时序管理工具。

**架构：** 前端使用原生 JavaScript、Vite 和甘特图组件；Rust 管理 SQLite 连接并提供任务读写命令；前端任务服务负责顺序写入和保存状态反馈。

**技术栈：** Tauri 2、Rust、rusqlite、SQLite、Vite、Vitest、原生 HTML/CSS/JavaScript。

---

### 阶段一：建立前端与桌面构建流水线

**涉及文件：**

- `package.json`
- `vite.config.js`
- `vitest.config.js`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`

- [x] 配置 Vite 前端构建与 Vitest 测试命令。
- [x] 配置 Tauri 开发服务器、生产资源和本地字体。
- [x] 引入 rusqlite 并启用内置 SQLite。
- [x] 移除未使用的桌面插件和额外权限。

验证：`npm install`、`npm test`、`npm run build`、`cargo test`。

### 阶段二：实现 SQLite 数据层

**涉及文件：**

- `src-tauri/src/db.rs`
- `src-tauri/src/lib.rs`

先为数据库行为编写测试，再实现对应能力：

- [x] 初始化任务表。
- [x] 为旧数据库自动增加任务状态字段。
- [x] 保存并重新读取任务及依赖关系。
- [x] 单独更新日期和进度。
- [x] 删除任务并清理其他任务中的失效依赖。
- [x] 验证关闭并重新打开数据库后数据仍然存在。
- [x] 注册 Tauri 读写命令。

验证：`cargo test`。

### 阶段三：实现前端任务服务

**涉及文件：**

- `src/task-store.js`
- `tests/task-store.test.js`

先编写失败测试，再实现：

- [x] 数据库对象到甘特图对象的映射。
- [x] 完成、未完成、延期、搁置四种状态映射。
- [x] 状态数量统计。
- [x] 本地日期格式化与日期增加。
- [x] 任务写入顺序队列。

验证：`npm test`。

### 阶段四：实现项目时序管理界面

**涉及文件：**

- `src/index.html`
- `src/main.js`
- `src/styles.css`
- `src/chart-config.js`

- [x] 实现单窗口任务时间线。
- [x] 实现任务创建、编辑和删除弹窗。
- [x] 实现前置任务选择、备注和状态设置。
- [x] 实现日期与进度自动保存。
- [x] 实现横向无限日期扩展和时间粒度切换。
- [x] 实现深色科技视觉、状态统计和启动动画。
- [x] 支持键盘焦点、减少动态效果和窄窗口布局。

验证：`npm run build`。

### 阶段五：发布验证

**涉及文件：**

- `README.md`
- `src-tauri/tauri.conf.json`

- [x] 运行前端和 Rust 测试。
- [x] 运行前端生产构建。
- [x] 验证发布窗口、数据库持久化和界面状态。
- [ ] 由项目维护者执行 Windows 安装包构建。

安装包构建命令：

```powershell
npm run tauri build
```

预期安装包：

```text
src-tauri/target/release/bundle/nsis/时序任务管理_0.1.0_x64-setup.exe
```
