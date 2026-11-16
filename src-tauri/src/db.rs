use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Task {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) status: String,
    pub(crate) start_date: String,
    pub(crate) end_date: String,
    pub(crate) progress: f64,
    pub(crate) dependencies: Vec<String>,
    pub(crate) notes: String,
    pub(crate) sort_order: i64,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

pub(crate) fn init_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                start_date TEXT NOT NULL DEFAULT '',
                end_date TEXT NOT NULL DEFAULT '',
                progress REAL NOT NULL DEFAULT 0,
                dependencies TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );
            ",
        )
        .map_err(|error| error.to_string())?;

    let has_status = connection
        .prepare("PRAGMA table_info(tasks)")
        .map_err(|error| error.to_string())?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?
        .iter()
        .any(|column| column == "status");

    if !has_status {
        connection
            .execute(
                "ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(crate) fn list_tasks(connection: &Connection) -> Result<Vec<Task>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, name, start_date, end_date, progress, dependencies,
                   notes, sort_order, created_at, updated_at, status
            FROM tasks
            ORDER BY sort_order ASC, created_at ASC, id ASC
            ",
        )
        .map_err(|error| error.to_string())?;

    let tasks = statement
        .query_map([], |row| {
            let dependencies: String = row.get(5)?;
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(10)?,
                start_date: row.get(2)?,
                end_date: row.get(3)?,
                progress: row.get(4)?,
                dependencies: serde_json::from_str(&dependencies).unwrap_or_default(),
                notes: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(tasks)
}

pub(crate) fn save_task(connection: &Connection, task: &Task) -> Result<(), String> {
    let dependencies =
        serde_json::to_string(&task.dependencies).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT INTO tasks (
                id, name, start_date, end_date, progress, dependencies,
                notes, sort_order, created_at, updated_at, status
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                progress = excluded.progress,
                dependencies = excluded.dependencies,
                notes = excluded.notes,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at,
                status = excluded.status
            ",
            rusqlite::params![
                task.id,
                task.name,
                task.start_date,
                task.end_date,
                task.progress,
                dependencies,
                task.notes,
                task.sort_order,
                task.created_at,
                task.updated_at,
                task.status,
            ],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub(crate) fn update_task_dates(
    connection: &Connection,
    id: &str,
    start_date: &str,
    end_date: &str,
    updated_at: &str,
) -> Result<(), String> {
    connection
        .execute(
            "
            UPDATE tasks
            SET start_date = ?2, end_date = ?3, updated_at = ?4
            WHERE id = ?1
            ",
            rusqlite::params![id, start_date, end_date, updated_at],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub(crate) fn update_task_progress(
    connection: &Connection,
    id: &str,
    progress: f64,
    updated_at: &str,
) -> Result<(), String> {
    connection
        .execute(
            "
            UPDATE tasks
            SET progress = ?2, updated_at = ?3
            WHERE id = ?1
            ",
            rusqlite::params![id, progress, updated_at],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub(crate) fn delete_task(connection: &Connection, id: &str) -> Result<(), String> {
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    for mut task in list_tasks(&transaction)? {
        let original_length = task.dependencies.len();
        task.dependencies.retain(|dependency| dependency != id);
        if task.dependencies.len() != original_length {
            save_task(&transaction, &task)?;
        }
    }

    transaction
        .execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    transaction
        .commit()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_database() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        init_schema(&connection).unwrap();
        connection
    }

    fn sample_task() -> Task {
        Task {
            id: "task-1".into(),
            name: "整理需求".into(),
            status: "delayed".into(),
            start_date: "2026-11-16".into(),
            end_date: "2026-11-20".into(),
            progress: 20.0,
            dependencies: vec!["task-0".into(), "task-2".into()],
            notes: "先确认范围".into(),
            sort_order: 1,
            created_at: "2026-11-16T08:00:00.000Z".into(),
            updated_at: "2026-11-16T08:00:00.000Z".into(),
        }
    }

    #[test]
    fn starts_with_an_empty_task_list() {
        let connection = memory_database();
        assert!(list_tasks(&connection).unwrap().is_empty());
    }

    #[test]
    fn upgrades_an_existing_database_with_pending_status() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "
                CREATE TABLE tasks (
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
                INSERT INTO tasks (id, name) VALUES ('legacy-task', '旧任务');
                ",
            )
            .unwrap();

        init_schema(&connection).unwrap();

        let status: String = connection
            .query_row(
                "SELECT status FROM tasks WHERE id = 'legacy-task'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "pending");
    }

    #[test]
    fn saves_and_reloads_a_task_with_dependencies() {
        let connection = memory_database();
        let task = sample_task();

        save_task(&connection, &task).unwrap();

        assert_eq!(list_tasks(&connection).unwrap(), vec![task]);
    }

    #[test]
    fn updates_only_task_dates() {
        let connection = memory_database();
        save_task(&connection, &sample_task()).unwrap();

        update_task_dates(
            &connection,
            "task-1",
            "2026-11-18",
            "2026-11-24",
            "2026-11-16T09:00:00.000Z",
        )
        .unwrap();

        let task = list_tasks(&connection).unwrap().remove(0);
        assert_eq!(task.start_date, "2026-11-18");
        assert_eq!(task.end_date, "2026-11-24");
        assert_eq!(task.name, "整理需求");
    }

    #[test]
    fn updates_only_task_progress() {
        let connection = memory_database();
        save_task(&connection, &sample_task()).unwrap();

        update_task_progress(
            &connection,
            "task-1",
            85.0,
            "2026-11-16T10:00:00.000Z",
        )
        .unwrap();

        let task = list_tasks(&connection).unwrap().remove(0);
        assert_eq!(task.progress, 85.0);
        assert_eq!(task.start_date, "2026-11-16");
    }

    #[test]
    fn deletes_a_task() {
        let connection = memory_database();
        save_task(&connection, &sample_task()).unwrap();

        delete_task(&connection, "task-1").unwrap();

        assert!(list_tasks(&connection).unwrap().is_empty());
    }

    #[test]
    fn removes_a_deleted_task_from_other_dependencies() {
        let connection = memory_database();
        let parent = sample_task();
        let mut child = sample_task();
        child.id = "task-2".into();
        child.name = "后续任务".into();
        child.dependencies = vec!["task-1".into()];
        save_task(&connection, &parent).unwrap();
        save_task(&connection, &child).unwrap();

        delete_task(&connection, "task-1").unwrap();

        let tasks = list_tasks(&connection).unwrap();
        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].dependencies.is_empty());
    }

    #[test]
    fn task_survives_closing_and_reopening_the_database() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("desktop-task-{unique}.db"));

        {
            let connection = Connection::open(&path).unwrap();
            init_schema(&connection).unwrap();
            save_task(&connection, &sample_task()).unwrap();
        }

        {
            let connection = Connection::open(&path).unwrap();
            init_schema(&connection).unwrap();
            assert_eq!(list_tasks(&connection).unwrap(), vec![sample_task()]);
        }

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
    }
}
