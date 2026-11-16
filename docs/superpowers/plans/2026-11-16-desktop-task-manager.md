# Desktop Task Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-window Tauri task manager that stores permissively structured task data in local SQLite.

**Architecture:** A Vite-powered vanilla JavaScript frontend imports the sibling Frappe Gantt source. Rust owns a mutex-protected SQLite connection and exposes five narrow commands to the frontend. A serialized JavaScript store handles automatic persistence.

**Tech Stack:** Tauri 2, Rust, rusqlite with bundled SQLite, Vite, Vitest, vanilla HTML/CSS/JavaScript.

---

### Task 1: Configure the Vite and Tauri frontend pipeline

**Files:**
- Modify: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`

- [ ] Add `vite`, `vitest`, and `@tauri-apps/api`; expose scripts `dev`, `build`, `test`, and `tauri`.
- [ ] Configure Vite with `src` as the HTML root and `dist` as the output directory.
- [ ] Allow Vite development access to the sibling `gantt` source directory.
- [ ] Configure Tauri to run `npm run dev`, load `http://localhost:1420`, and bundle `../dist`.
- [ ] Remove the unused opener plugin and its permission.
- [ ] Add `rusqlite = { version = "0.43", features = ["bundled"] }`.
- [ ] Run `npm install` and `cargo check`.

Expected: both JavaScript and Rust dependency graphs resolve successfully.

### Task 2: Implement the SQLite repository with tests first

**Files:**
- Create: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] Add tests for an empty list after schema initialization.
- [ ] Add a test that saves and reloads a task with two dependencies.
- [ ] Add a test that updates only task dates.
- [ ] Add a test that updates only task progress.
- [ ] Add a test that deletes a task.
- [ ] Run `cargo test`; expect failures because the repository functions do not exist.
- [ ] Create a permissive `tasks` table with no foreign keys, check constraints, or authentication tables.
- [ ] Implement `init_schema`, `list_tasks`, `save_task`, `update_task_dates`, `update_task_progress`, and `delete_task`.
- [ ] Register the database state and five Tauri commands.
- [ ] Run `cargo test`; expect all tests to pass.

Expected schema:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    progress REAL NOT NULL DEFAULT 0,
    dependencies TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);
```

### Task 3: Implement the frontend task store with tests first

**Files:**
- Create: `src/task-store.js`
- Create: `tests/task-store.test.js`

- [ ] Add a failing test that maps `startDate` and `dependencies` from a database task into a Gantt task.
- [ ] Add a failing test that formats a local `Date` as `YYYY-MM-DD`.
- [ ] Add a failing test proving two queued writes execute in call order.
- [ ] Run `npm test`; expect failures because `task-store.js` does not exist.
- [ ] Implement `toGanttTask`, `formatDateInput`, `addDays`, and `TaskStore`.
- [ ] Serialize all database writes through one promise queue and expose `flush()`.
- [ ] Run `npm test`; expect all tests to pass.

Expected public methods:

```js
store.list()
store.save(task)
store.delete(id)
store.updateDates(id, start, end)
store.updateProgress(id, progress)
store.flush()
```

### Task 4: Build the minimal task manager interface

**Files:**
- Modify: `src/index.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`

- [ ] Replace the scaffold screen with a single desktop workspace.
- [ ] Import Gantt directly from `../../gantt/src/index.js`.
- [ ] Load SQLite tasks at startup and show an empty-state action.
- [ ] Add a native dialog for task creation and editing.
- [ ] Add dependency selection for all other tasks.
- [ ] Persist date and progress changes through `TaskStore`.
- [ ] Refresh the chart after create, edit, and delete.
- [ ] Add save-status and error feedback.
- [ ] Run `npm run build`; expect a successful Vite bundle.

### Task 5: Verify the complete desktop application

**Files:**
- Modify: `README.md`

- [ ] Run `npm test`.
- [ ] Run `cargo test` in `src-tauri`.
- [ ] Run `npm run build`.
- [ ] Run `npm run tauri build`.
- [ ] Launch the packaged application or development window and confirm the empty state renders.
- [ ] Create a task, edit it, drag its dates, change progress, close the app, and reopen it.
- [ ] Confirm the task and changes persist in SQLite.
- [ ] Document development, test, build, and database-location information.

Expected: all tests pass, the desktop bundle builds, and task data survives a restart.
