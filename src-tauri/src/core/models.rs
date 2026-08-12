use serde::{Deserialize, Serialize};

/// 代理类型。当前仅支持 SOCKS5；前端已不提供类型选择，
/// 默认值即为 Socks5，None 保留用于将来扩展/显式禁用。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProxyType {
    None,
    #[default]
    Socks5,
}

/// 代理配置（来自前端 store）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub enabled: bool,
    #[serde(default)]
    pub r#type: ProxyType,
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeyEntry {
    pub id: String,
    pub name: String,
    pub key_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub content: String,
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
    /// 实际连接通道：走代理时为 "host:port"，直连为 None
    pub via_proxy: Option<String>,
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
    pub idle_timeout: u32,
}

/// SSOT：所有 SSH 默认值在此定义，ssh.rs 统一引用。
impl SshDefaults {
    pub const DEFAULT_MONITOR_INTERVAL: u32 = 4;
    pub const DEFAULT_HEARTBEAT_INTERVAL: u32 = 10;
    /// 闲置自动断连时间（秒）。0 表示禁用自动断连。
    pub const DEFAULT_IDLE_TIMEOUT: u32 = 300;
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
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub uptime: String,
    pub load: String,
    pub cpu: String,
    pub memory: String,
    pub swap: String,
    #[serde(default)]
    pub net_io: String,
    pub processes: Vec<ProcessInfo>,
    pub disks: Vec<DiskInfo>,
}
