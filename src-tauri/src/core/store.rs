use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};

use super::models::{AppConfig, HostConfig, HotkeyBinding, KeyEntry, SshDefaults};

#[derive(Default)]
struct DirtyFlags {
    hosts: bool,
    groups: bool,
    keys: bool,
    hotkeys: bool,
    config: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Store {
    hosts: Vec<HostConfig>,
    groups: Vec<String>,
    keys: Vec<KeyEntry>,
    hotkeys: HashMap<String, HotkeyBinding>,
    config: HashMap<String, String>,
    #[serde(skip)]
    dirty: DirtyFlags,
}

static STORE: OnceLock<RwLock<Store>> = OnceLock::new();
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

fn data_dir() -> Result<&'static Path, String> {
    DATA_DIR.get().map(|p| p.as_path()).ok_or_else(|| "store not initialized".to_string())
}

fn store() -> Result<&'static RwLock<Store>, String> {
    STORE.get().ok_or_else(|| "store not initialized".to_string())
}

pub fn init(data_dir: &Path) -> Result<(), String> {
    let dir = data_dir.to_path_buf();
    DATA_DIR.set(dir.clone()).map_err(|_| "already initialized".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create data dir: {}", e))?;
    let store = load_all(&dir);
    STORE
        .set(RwLock::new(store))
        .map_err(|_| "already initialized".to_string())
}

fn read<T>(f: impl FnOnce(&Store) -> T) -> Result<T, String> {
    let guard = store()?.read().map_err(|e| format!("lock error: {}", e))?;
    Ok(f(&guard))
}

fn write<T>(f: impl FnOnce(&mut Store) -> T) -> Result<T, String> {
    let mut guard = store()?.write().map_err(|e| format!("lock error: {}", e))?;
    let result = f(&mut guard);
    let dir = data_dir()?;
    if guard.dirty.hosts {
        save_json(dir, "hosts.json", &guard.hosts)?;
    }
    if guard.dirty.groups {
        save_json(dir, "groups.json", &guard.groups)?;
    }
    if guard.dirty.keys {
        save_json(dir, "keys.json", &guard.keys)?;
    }
    if guard.dirty.hotkeys {
        save_json(dir, "hotkeys.json", &guard.hotkeys)?;
    }
    if guard.dirty.config {
        save_json(dir, "config.json", &guard.config)?;
    }
    guard.dirty = DirtyFlags::default();
    Ok(result)
}

fn load_json<T: serde::de::DeserializeOwned>(dir: &Path, name: &str) -> Option<T> {
    let path = dir.join(name);
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_json<T: serde::Serialize>(dir: &Path, name: &str, value: &T) -> Result<(), String> {
    let path = dir.join(name);
    let tmp_path = dir.join(format!("{}.tmp", name));
    let content =
        serde_json::to_string_pretty(value).map_err(|e| format!("serialize {}: {}", name, e))?;
    fs::write(&tmp_path, &content).map_err(|e| format!("write {}: {}", name, e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("rename {}: {}", name, e))?;
    Ok(())
}

fn load_all(dir: &Path) -> Store {
    // Clean up any stale .tmp files from a previous crash
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().ends_with(".tmp") {
                fs::remove_file(entry.path()).ok();
            }
        }
    }
    Store {
        hosts: load_json(dir, "hosts.json").unwrap_or_default(),
        groups: load_json(dir, "groups.json").unwrap_or_default(),
        keys: load_json(dir, "keys.json").unwrap_or_default(),
        hotkeys: load_json(dir, "hotkeys.json").unwrap_or_else(hardcoded_hotkey_defaults),
        config: load_json(dir, "config.json").unwrap_or_else(default_config),
        dirty: DirtyFlags::default(),
    }
}

fn hardcoded_hotkey_defaults() -> HashMap<String, HotkeyBinding> {
    let mut map = HashMap::new();
    map.insert(
        "duplicateTab".to_string(),
        HotkeyBinding {
            key: "N".to_string(),
            ctrl: false,
            shift: false,
            alt: false,
            meta: true,
        },
    );
    map.insert(
        "reconnectTab".to_string(),
        HotkeyBinding {
            key: "R".to_string(),
            ctrl: false,
            shift: false,
            alt: false,
            meta: true,
        },
    );
    map
}

fn default_config() -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("ssh_defaults_hostname".into(), String::new());
    map.insert("ssh_defaults_username".into(), String::new());
    map.insert("ssh_defaults_port".into(), "22".into());
    map.insert("ssh_defaults_monitor_interval".into(), "4".into());
    map.insert("ssh_defaults_heartbeat_interval".into(), "10".into());
    map
}

// ── Public API ──

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
        keys_path: super::keys_path().to_string_lossy().to_string(),
        ssh_defaults,
        hotkey_defaults: load_hotkeys().unwrap_or_default(),
    }
}

// ── Hosts ──

pub fn list_hosts() -> Result<Vec<HostConfig>, String> {
    read(|s| s.hosts.clone())
}

pub fn save_host(host: HostConfig) -> Result<HostConfig, String> {
    let now = chrono::Utc::now().timestamp();
    write(|s| {
        s.dirty.hosts = true;
        if let Some(existing) = s
            .hosts
            .iter_mut()
            .find(|h| h.id == host.id && !host.id.is_empty())
        {
            *existing = HostConfig {
                updated_at: now,
                ..host.clone()
            };
            existing.clone()
        } else {
            let id = if host.id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                host.id.clone()
            };
            let entry = HostConfig {
                id,
                created_at: now,
                updated_at: now,
                ..host
            };
            s.hosts.push(entry.clone());
            entry
        }
    })
}

pub fn delete_host(id: String) -> Result<(), String> {
    write(|s| {
        s.dirty.hosts = true;
        s.hosts.retain(|h| h.id != id);
    })
}

// ── Groups ──

pub fn list_groups() -> Result<Vec<String>, String> {
    read(|s| s.groups.clone())
}

pub fn save_group(group: String) -> Result<(), String> {
    write(|s| {
        if !s.groups.contains(&group) {
            s.dirty.groups = true;
            s.groups.push(group);
        }
    })
}

pub fn delete_group(group: String) -> Result<(), String> {
    write(|s| {
        s.dirty.groups = true;
        s.dirty.hosts = true;
        s.groups.retain(|g| g != &group);
        for host in &mut s.hosts {
            if host.group.as_deref() == Some(&group) {
                host.group = None;
            }
        }
    })
}

pub fn hosts_using_key(file_name: &str) -> Result<Vec<String>, String> {
    read(|s| {
        s.hosts
            .iter()
            .filter(|h| {
                h.private_key_path
                    .as_deref()
                    .is_some_and(|p| p.ends_with(file_name))
            })
            .map(|h| h.name.clone())
            .collect()
    })
}

// ── Keys ──

pub fn list_keys() -> Result<Vec<KeyEntry>, String> {
    read(|s| {
        let mut keys = s.keys.clone();
        keys.sort_by_key(|b| std::cmp::Reverse(b.imported_at));
        keys
    })
}

pub fn insert_key(entry: &KeyEntry) -> Result<(), String> {
    write(|s| {
        s.dirty.keys = true;
        s.keys.push(entry.clone());
    })
}

pub fn key_exists_by_file_name(file_name: &str) -> Result<bool, String> {
    read(|s| s.keys.iter().any(|k| k.file_name == file_name))
}

pub fn delete_key(id: String) -> Result<KeyEntry, String> {
    let entry = read(|s| s.keys.iter().find(|k| k.id == id).cloned())?
        .ok_or_else(|| "key not found".to_string())?;
    write(|s| {
        s.dirty.keys = true;
        s.keys.retain(|k| k.id != id);
    })?;
    Ok(entry)
}

// ── Hotkeys ──

pub fn load_hotkeys() -> Result<HashMap<String, HotkeyBinding>, String> {
    read(|s| s.hotkeys.clone())
}

pub fn save_hotkeys(config: HashMap<String, HotkeyBinding>) -> Result<(), String> {
    write(|s| {
        s.dirty.hotkeys = true;
        s.hotkeys = config;
    })
}

// ── Bulk import (used by restore) ──

pub fn import_hosts(hosts: &[HostConfig]) -> Result<(), String> {
    if hosts.is_empty() {
        return Ok(());
    }
    write(|s| {
        s.dirty.hosts = true;
        for host in hosts {
            if let Some(existing) = s.hosts.iter_mut().find(|h| h.id == host.id) {
                if host.updated_at > existing.updated_at {
                    *existing = host.clone();
                }
            } else {
                s.hosts.push(host.clone());
            }
            if let Some(ref g) = host.group {
                if !s.groups.contains(g) {
                    s.dirty.groups = true;
                    s.groups.push(g.clone());
                }
            }
        }
    })
}

pub fn import_groups(groups: &[String]) -> Result<(), String> {
    if groups.is_empty() {
        return Ok(());
    }
    write(|s| {
        s.dirty.groups = true;
        for g in groups {
            if !s.groups.contains(g) {
                s.groups.push(g.clone());
            }
        }
    })
}

pub fn import_keys(keys: &[KeyEntry]) -> Result<(), String> {
    if keys.is_empty() {
        return Ok(());
    }
    write(|s| {
        s.dirty.keys = true;
        for entry in keys {
            if let Some(existing) = s.keys.iter_mut().find(|k| k.id == entry.id) {
                if entry.imported_at > existing.imported_at {
                    *existing = entry.clone();
                }
            } else {
                s.keys.push(entry.clone());
            }
        }
    })
}

pub fn import_hotkeys(hotkeys: HashMap<String, HotkeyBinding>) -> Result<(), String> {
    write(|s| {
        s.dirty.hotkeys = true;
        for (action, binding) in hotkeys {
            s.hotkeys.insert(action, binding);
        }
    })
}

pub fn import_config(config: HashMap<String, String>) -> Result<(), String> {
    write(|s| {
        s.dirty.config = true;
        for (k, v) in config {
            s.config.insert(k, v);
        }
    })
}

// ── SSH Defaults ──

pub fn get_ssh_defaults() -> Result<SshDefaults, String> {
    read(|s| {
        let cfg = &s.config;
        SshDefaults {
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
        }
    })
}

pub fn save_ssh_defaults(d: &SshDefaults) -> Result<(), String> {
    write(|s| {
        s.dirty.config = true;
        let cfg = &mut s.config;
        cfg.insert("ssh_defaults_hostname".into(), d.hostname.clone());
        cfg.insert("ssh_defaults_username".into(), d.username.clone());
        cfg.insert("ssh_defaults_port".into(), d.port.to_string());
        cfg.insert(
            "ssh_defaults_monitor_interval".into(),
            d.monitor_interval.to_string(),
        );
        cfg.insert(
            "ssh_defaults_heartbeat_interval".into(),
            d.heartbeat_interval.to_string(),
        );
        cfg.insert(
            "ssh_defaults_reconnect_enabled".into(),
            d.reconnect_enabled.to_string(),
        );
        cfg.insert(
            "ssh_defaults_reconnect_max_retries".into(),
            d.reconnect_max_retries.to_string(),
        );
        cfg.insert(
            "ssh_defaults_reconnect_initial_delay".into(),
            d.reconnect_initial_delay.to_string(),
        );
        cfg.insert(
            "ssh_defaults_reconnect_max_delay".into(),
            d.reconnect_max_delay.to_string(),
        );
    })
}
