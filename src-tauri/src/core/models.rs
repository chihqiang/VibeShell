use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub data_path: String,
    pub keys_path: String,
    pub ssh_defaults: SshDefaults,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HostConfig {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub group: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub last_connected_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeyEntry {
    pub id: String,
    pub name: String,
    pub file_name: String,
    pub key_type: String,
    pub fingerprint: String,
    pub imported_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub file_type: String,
    pub size: i64,
    pub mode: String,
    pub perm: i64,
    pub modified: String,
    pub uid: i64,
    pub gid: i64,
    pub user: String,
    pub group: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SftpListResult {
    pub path: String,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshConnectResult {
    pub id: String,
    pub banner: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsersGroups {
    pub users: Vec<String>,
    pub groups: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshExecuteResult {
    pub tab_id: String,
    pub exit_code: i32,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshDefaults {
    pub hostname: String,
    pub username: String,
    pub port: u16,
    pub monitor_interval: u32,
    pub heartbeat_interval: u32,
    pub reconnect_enabled: bool,
    pub reconnect_max_retries: u32,
    pub reconnect_initial_delay: u32,
    pub reconnect_max_delay: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub mem: String,
    pub cpu: String,
    pub command: String,
    pub pid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub path: String,
    pub size: String,
    pub avail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorEvent {
    pub tab_id: String,
    pub ip: String,
    pub uptime: String,
    pub load: String,
    pub cpu: String,
    pub memory: String,
    pub swap: String,
    pub processes: Vec<ProcessInfo>,
    pub disks: Vec<DiskInfo>,
}
