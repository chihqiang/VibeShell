use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use rusqlite::{params, Connection};

use super::models::{AppConfig, BackupPayload, HostConfig, KeyEntry, SshDefaults};

/// Global SQLite connection, protected by a Mutex for thread safety.
/// rusqlite::Connection is not Send, so we wrap in Mutex.
static DB: OnceLock<Mutex<Connection>> = OnceLock::new();
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("vibeshell.db")
}

fn db() -> Result<std::sync::MutexGuard<'static, Connection>, String> {
    DB.get()
        .ok_or_else(|| "store not initialized".to_string())?
        .lock()
        .map_err(|e| format!("db lock error: {}", e))
}

// ── Schema ──

fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS hosts (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            hostname        TEXT NOT NULL,
            port            INTEGER NOT NULL DEFAULT 22,
            username        TEXT NOT NULL,
            auth_method     TEXT NOT NULL DEFAULT 'password',
            password        TEXT,
            private_key_path TEXT,
            tags            TEXT DEFAULT '[]',
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            last_connected_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS keys (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            file_name   TEXT NOT NULL,
            key_type    TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            content     TEXT NOT NULL,
            imported_at INTEGER NOT NULL,
            password    TEXT
        );

        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| format!("failed to create tables: {}", e))?;
    Ok(())
}

// ── Init ──

pub fn init(data_dir: &Path) -> Result<(), String> {
    let dir = data_dir.to_path_buf();
    DATA_DIR
        .set(dir.clone())
        .map_err(|_| "already initialized".to_string())?;

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create data dir: {}", e))?;

    let conn = Connection::open(db_path(&dir))
        .map_err(|e| format!("failed to open db: {}", e))?;

    // Performance: WAL mode for better concurrent read performance
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA foreign_keys=ON;",
    )
    .map_err(|e| format!("failed to set pragmas: {}", e))?;

    create_tables(&conn)?;

    DB.set(Mutex::new(conn))
        .map_err(|_| "already initialized".to_string())?;

    Ok(())
}

/// Acquire a write lock as a barrier — ensures no concurrent write is in-flight.
/// With SQLite WAL mode this is mostly a no-op, but provides a synchronization
/// point for backup to read a consistent snapshot.
pub fn sync_barrier() -> Result<(), String> {
    let _guard = db()?;
    Ok(())
}

// ── AppConfig ──

pub fn get_app_config(data_dir: &Path) -> AppConfig {
    let ssh_defaults = get_ssh_defaults().unwrap_or(SshDefaults {
        hostname: String::new(),
        username: String::new(),
        port: 22,
        monitor_interval: 4,
        heartbeat_interval: 10,
        reconnect_enabled: true,
        reconnect_max_retries: 10,
        reconnect_initial_delay: 1,
        reconnect_max_delay: 30,
    });
    AppConfig {
        data_path: data_dir.to_string_lossy().to_string(),
        keys_path: String::new(), // no longer a separate keys directory
        ssh_defaults,
    }
}

// ── Hosts ──

fn row_to_host(row: &rusqlite::Row) -> rusqlite::Result<HostConfig> {
    let tags_str: String = row.get("tags")?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(HostConfig {
        id: row.get("id")?,
        name: row.get("name")?,
        hostname: row.get("hostname")?,
        port: row.get("port")?,
        username: row.get("username")?,
        auth_method: row.get("auth_method")?,
        password: row.get("password")?,
        private_key_path: row.get("private_key_path")?,
        tags,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        last_connected_at: row.get("last_connected_at")?,
    })
}

pub fn list_hosts() -> Result<Vec<HostConfig>, String> {
    let conn = db()?;
    let mut stmt = conn
        .prepare("SELECT * FROM hosts ORDER BY updated_at DESC")
        .map_err(|e| format!("list hosts prepare: {}", e))?;
    let rows = stmt
        .query_map([], row_to_host)
        .map_err(|e| format!("list hosts query: {}", e))?;
    let mut hosts = Vec::new();
    for row in rows {
        hosts.push(row.map_err(|e| format!("list hosts row: {}", e))?);
    }
    Ok(hosts)
}

pub fn save_host(host: HostConfig) -> Result<HostConfig, String> {
    let now = chrono::Utc::now().timestamp();
    let conn = db()?;

    // Check if exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM hosts WHERE id = ?1",
            params![host.id],
            |row| row.get(0),
        )
        .ok();

    let tags_json =
        serde_json::to_string(&host.tags).map_err(|e| format!("serialize tags: {}", e))?;

    if existing.is_some() && !host.id.is_empty() {
        conn.execute(
            "UPDATE hosts SET name=?1, hostname=?2, port=?3, username=?4,
             auth_method=?5, password=?6, private_key_path=?7, tags=?8,
             updated_at=?9, last_connected_at=?10
             WHERE id=?11",
            params![
                host.name,
                host.hostname,
                host.port,
                host.username,
                host.auth_method,
                host.password,
                host.private_key_path,
                tags_json,
                now,
                host.last_connected_at,
                host.id,
            ],
        )
        .map_err(|e| format!("update host: {}", e))?;

        Ok(HostConfig {
            updated_at: now,
            ..host
        })
    } else {
        let id = if host.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            host.id.clone()
        };
        conn.execute(
            "INSERT INTO hosts (id, name, hostname, port, username, auth_method,
             password, private_key_path, tags, created_at, updated_at, last_connected_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                id,
                host.name,
                host.hostname,
                host.port,
                host.username,
                host.auth_method,
                host.password,
                host.private_key_path,
                tags_json,
                now,
                now,
                host.last_connected_at,
            ],
        )
        .map_err(|e| format!("insert host: {}", e))?;

        Ok(HostConfig {
            id,
            created_at: now,
            updated_at: now,
            ..host
        })
    }
}

pub fn delete_host(id: String) -> Result<(), String> {
    let conn = db()?;
    conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])
        .map_err(|e| format!("delete host: {}", e))?;
    Ok(())
}

// ── Tags ──

pub fn list_tags() -> Result<Vec<String>, String> {
    let conn = db()?;
    let mut stmt = conn
        .prepare("SELECT tags FROM hosts")
        .map_err(|e| format!("list tags prepare: {}", e))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("list tags query: {}", e))?;

    let mut tags: Vec<String> = Vec::new();
    for row in rows {
        let raw = row.map_err(|e| format!("list tags row: {}", e))?;
        if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&raw) {
            tags.extend(parsed);
        }
    }
    tags.sort();
    tags.dedup();
    Ok(tags)
}

pub fn hosts_using_key(file_name: &str) -> Result<Vec<String>, String> {
    let conn = db()?;
    // Match hosts whose private_key_path contains the file_name
    let mut stmt = conn
        .prepare("SELECT name FROM hosts WHERE private_key_path LIKE ?1")
        .map_err(|e| format!("hosts_using_key prepare: {}", e))?;
    let pattern = format!("%{}%", file_name);
    let rows = stmt
        .query_map(params![pattern], |row| row.get::<_, String>(0))
        .map_err(|e| format!("hosts_using_key query: {}", e))?;
    let mut names = Vec::new();
    for row in rows {
        names.push(row.map_err(|e| format!("hosts_using_key row: {}", e))?);
    }
    Ok(names)
}

// ── Keys ──

fn row_to_key(row: &rusqlite::Row) -> rusqlite::Result<KeyEntry> {
    Ok(KeyEntry {
        id: row.get("id")?,
        name: row.get("name")?,
        file_name: row.get("file_name")?,
        key_type: row.get("key_type")?,
        fingerprint: row.get("fingerprint")?,
        content: row.get("content")?,
        imported_at: row.get("imported_at")?,
        password: row.get("password")?,
    })
}

pub fn list_keys() -> Result<Vec<KeyEntry>, String> {
    let conn = db()?;
    let mut stmt = conn
        .prepare("SELECT * FROM keys ORDER BY imported_at DESC")
        .map_err(|e| format!("list keys prepare: {}", e))?;
    let rows = stmt
        .query_map([], row_to_key)
        .map_err(|e| format!("list keys query: {}", e))?;
    let mut keys = Vec::new();
    for row in rows {
        keys.push(row.map_err(|e| format!("list keys row: {}", e))?);
    }
    Ok(keys)
}

pub fn insert_key(entry: &KeyEntry) -> Result<(), String> {
    let conn = db()?;
    conn.execute(
        "INSERT INTO keys (id, name, file_name, key_type, fingerprint, content, imported_at, password)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            entry.id,
            entry.name,
            entry.file_name,
            entry.key_type,
            entry.fingerprint,
            entry.content,
            entry.imported_at,
            entry.password,
        ],
    )
    .map_err(|e| format!("insert key: {}", e))?;
    Ok(())
}

pub fn key_exists_by_file_name(file_name: &str) -> Result<bool, String> {
    let conn = db()?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM keys WHERE file_name = ?1",
            params![file_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("key_exists query: {}", e))?;
    Ok(count > 0)
}

pub fn delete_key(id: String) -> Result<KeyEntry, String> {
    let conn = db()?;
    let entry = conn
        .query_row(
            "SELECT * FROM keys WHERE id = ?1",
            params![id],
            row_to_key,
        )
        .map_err(|e| format!("delete_key find: {}", e))?;
    conn.execute("DELETE FROM keys WHERE id = ?1", params![id])
        .map_err(|e| format!("delete_key delete: {}", e))?;
    Ok(entry)
}

/// Read key content by ID. Used by session.rs when connecting with a vibeshell://key/ reference.
pub fn get_key_content(id: &str) -> Result<Option<String>, String> {
    let conn = db()?;
    let result: Result<String, _> = conn.query_row(
        "SELECT content FROM keys WHERE id = ?1",
        params![id],
        |row| row.get(0),
    );
    match result {
        Ok(content) => Ok(Some(content)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("get_key_content: {}", e)),
    }
}

// ── SSH Defaults ──

pub fn get_ssh_defaults() -> Result<SshDefaults, String> {
    let conn = db()?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM config WHERE key LIKE 'ssh_defaults_%'")
        .map_err(|e| format!("get_ssh_defaults prepare: {}", e))?;

    let mut cfg: HashMap<String, String> = HashMap::new();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("get_ssh_defaults query: {}", e))?;
    for row in rows {
        let (k, v) = row.map_err(|e| format!("get_ssh_defaults row: {}", e))?;
        cfg.insert(k, v);
    }

    Ok(SshDefaults {
        hostname: cfg
            .get("ssh_defaults_hostname")
            .cloned()
            .unwrap_or_default(),
        username: cfg
            .get("ssh_defaults_username")
            .cloned()
            .unwrap_or_default(),
        port: cfg
            .get("ssh_defaults_port")
            .and_then(|v| v.parse().ok())
            .unwrap_or(22),
        monitor_interval: cfg
            .get("ssh_defaults_monitor_interval")
            .and_then(|v| v.parse().ok())
            .unwrap_or(4),
        heartbeat_interval: cfg
            .get("ssh_defaults_heartbeat_interval")
            .and_then(|v| v.parse().ok())
            .unwrap_or(10),
        reconnect_enabled: cfg
            .get("ssh_defaults_reconnect_enabled")
            .map(|v| v != "false")
            .unwrap_or(true),
        reconnect_max_retries: cfg
            .get("ssh_defaults_reconnect_max_retries")
            .and_then(|v| v.parse().ok())
            .unwrap_or(10),
        reconnect_initial_delay: cfg
            .get("ssh_defaults_reconnect_initial_delay")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1),
        reconnect_max_delay: cfg
            .get("ssh_defaults_reconnect_max_delay")
            .and_then(|v| v.parse().ok())
            .unwrap_or(30),
    })
}

pub fn save_ssh_defaults(d: &SshDefaults) -> Result<(), String> {
    let conn = db()?;
    let set = |k: &str, v: &str| -> Result<(), String> {
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )
        .map_err(|e| format!("save config {}: {}", k, e))?;
        Ok(())
    };

    set("ssh_defaults_hostname", &d.hostname)?;
    set("ssh_defaults_username", &d.username)?;
    set("ssh_defaults_port", &d.port.to_string())?;
    set("ssh_defaults_monitor_interval", &d.monitor_interval.to_string())?;
    set("ssh_defaults_heartbeat_interval", &d.heartbeat_interval.to_string())?;
    set("ssh_defaults_reconnect_enabled", &d.reconnect_enabled.to_string())?;
    set("ssh_defaults_reconnect_max_retries", &d.reconnect_max_retries.to_string())?;
    set("ssh_defaults_reconnect_initial_delay", &d.reconnect_initial_delay.to_string())?;
    set("ssh_defaults_reconnect_max_delay", &d.reconnect_max_delay.to_string())?;
    Ok(())
}

// ── Bulk import (used by restore) ──

pub fn import_hosts(hosts: &[HostConfig]) -> Result<(), String> {
    if hosts.is_empty() {
        return Ok(());
    }
    let conn = db()?;
    conn.execute_batch("BEGIN")
        .map_err(|e| format!("import hosts begin transaction: {}", e))?;
    let result = (|| -> Result<(), String> {
    for host in hosts {
        let tags_json =
            serde_json::to_string(&host.tags).map_err(|e| format!("serialize tags: {}", e))?;

        let existing_updated: Option<i64> = conn
            .query_row(
                "SELECT updated_at FROM hosts WHERE id = ?1",
                params![host.id],
                |row| row.get(0),
            )
            .ok();

        if let Some(existing_updated) = existing_updated {
            if host.updated_at > existing_updated {
                conn.execute(
                    "UPDATE hosts SET name=?1, hostname=?2, port=?3, username=?4,
                     auth_method=?5, password=?6, private_key_path=?7, tags=?8,
                     updated_at=?9, last_connected_at=?10
                     WHERE id=?11",
                    params![
                        host.name,
                        host.hostname,
                        host.port,
                        host.username,
                        host.auth_method,
                        host.password,
                        host.private_key_path,
                        tags_json,
                        host.updated_at,
                        host.last_connected_at,
                        host.id,
                    ],
                )
                .map_err(|e| format!("import host update: {}", e))?;
            }
        } else {
            conn.execute(
                "INSERT INTO hosts (id, name, hostname, port, username, auth_method,
                 password, private_key_path, tags, created_at, updated_at, last_connected_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                params![
                    host.id,
                    host.name,
                    host.hostname,
                    host.port,
                    host.username,
                    host.auth_method,
                    host.password,
                    host.private_key_path,
                    tags_json,
                    host.created_at,
                    host.updated_at,
                    host.last_connected_at,
                ],
            )
            .map_err(|e| format!("import host insert: {}", e))?;
        }
    }
        Ok(())
    })();
    if result.is_ok() {
    conn.execute_batch("COMMIT")
        .map_err(|e| format!("import hosts commit: {}", e))?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }
    result
}

pub fn import_keys(keys: &[KeyEntry]) -> Result<(), String> {
    if keys.is_empty() {
        return Ok(());
    }
    let conn = db()?;
    conn.execute_batch("BEGIN")
        .map_err(|e| format!("import keys begin transaction: {}", e))?;
    let result = (|| -> Result<(), String> {
    for entry in keys {
        let existing_imported: Option<i64> = conn
            .query_row(
                "SELECT imported_at FROM keys WHERE id = ?1",
                params![entry.id],
                |row| row.get(0),
            )
            .ok();

        if let Some(existing_imported) = existing_imported {
            if entry.imported_at > existing_imported {
                conn.execute(
                    "UPDATE keys SET name=?1, file_name=?2, key_type=?3, fingerprint=?4,
                     content=?5, imported_at=?6, password=?7
                     WHERE id=?8",
                    params![
                        entry.name,
                        entry.file_name,
                        entry.key_type,
                        entry.fingerprint,
                        entry.content,
                        entry.imported_at,
                        entry.password,
                        entry.id,
                    ],
                )
                .map_err(|e| format!("import key update: {}", e))?;
            }
        } else {
            conn.execute(
                "INSERT INTO keys (id, name, file_name, key_type, fingerprint, content, imported_at, password)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    entry.id,
                    entry.name,
                    entry.file_name,
                    entry.key_type,
                    entry.fingerprint,
                    entry.content,
                    entry.imported_at,
                    entry.password,
                ],
            )
            .map_err(|e| format!("import key insert: {}", e))?;
        }
    }
        Ok(())
    })();
    if result.is_ok() {
    conn.execute_batch("COMMIT")
        .map_err(|e| format!("import keys commit: {}", e))?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }
    result
}

pub fn import_config(config: HashMap<String, String>) -> Result<(), String> {
    if config.is_empty() {
        return Ok(());
    }
    let conn = db()?;
    conn.execute_batch("BEGIN")
        .map_err(|e| format!("import config begin transaction: {}", e))?;
    let result = (|| -> Result<(), String> {
    for (k, v) in config {
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )
        .map_err(|e| format!("import config: {}", e))?;
    }
        Ok(())
    })();
    if result.is_ok() {
    conn.execute_batch("COMMIT")
        .map_err(|e| format!("import config commit: {}", e))?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }
    result
}

// ── Backup export / import ──

pub fn export_backup() -> Result<BackupPayload, String> {
    let hosts = list_hosts()?;
    let keys = list_keys()?;
    let conn = db()?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM config")
        .map_err(|e| format!("export config prepare: {}", e))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("export config query: {}", e))?;
    let mut config = HashMap::new();
    for row in rows {
        let (k, v) = row.map_err(|e| format!("export config row: {}", e))?;
        config.insert(k, v);
    }

    Ok(BackupPayload {
        version: 1,
        exported_at: chrono::Utc::now().timestamp(),
        hosts,
        keys,
        config,
    })
}

pub fn import_backup(data: BackupPayload) -> Result<(), String> {
    import_hosts(&data.hosts)?;
    import_keys(&data.keys)?;
    import_config(data.config)?;
    Ok(())
}
