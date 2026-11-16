mod db;

use db::Task;
use rusqlite::Connection;
use std::{
    fs,
    sync::{Mutex, MutexGuard},
};
use tauri::{Manager, State};

struct DatabaseState(Mutex<Connection>);

fn connection<'a>(
    state: &'a State<'_, DatabaseState>,
) -> Result<MutexGuard<'a, Connection>, String> {
    state
        .0
        .lock()
        .map_err(|_| "数据库连接暂时不可用".to_string())
}

#[tauri::command]
fn list_tasks(state: State<'_, DatabaseState>) -> Result<Vec<Task>, String> {
    db::list_tasks(&*connection(&state)?)
}

#[tauri::command]
fn save_task(task: Task, state: State<'_, DatabaseState>) -> Result<(), String> {
    db::save_task(&*connection(&state)?, &task)
}

#[tauri::command]
fn update_task_dates(
    id: String,
    start_date: String,
    end_date: String,
    updated_at: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    db::update_task_dates(
        &*connection(&state)?,
        &id,
        &start_date,
        &end_date,
        &updated_at,
    )
}

#[tauri::command]
fn update_task_progress(
    id: String,
    progress: f64,
    updated_at: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    db::update_task_progress(&*connection(&state)?, &id, progress, &updated_at)
}

#[tauri::command]
fn delete_task(id: String, state: State<'_, DatabaseState>) -> Result<(), String> {
    db::delete_task(&*connection(&state)?, &id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_directory = app
                .path()
                .app_data_dir()
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            fs::create_dir_all(&data_directory)?;

            let database_path = data_directory.join("tasks.db");
            let database = Connection::open(database_path)
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            db::init_schema(&database)
                .map_err(|error| std::io::Error::other(error))?;

            app.manage(DatabaseState(Mutex::new(database)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            save_task,
            update_task_dates,
            update_task_progress,
            delete_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
