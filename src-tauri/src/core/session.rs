use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Condvar, LazyLock, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use ssh2::{Channel, Session, Sftp};
use tauri::Emitter;

use crate::core;

// ── TabSession — unified SSH + SFTP connection ──

/// Max consecutive emit failures before the session is considered orphaned
/// (frontend window closed or crashed) and auto-cleanup triggers.
const MAX_EMIT_FAILURES: u32 = 3;

/// If the frontend hasn't sent any `ssh_write` for this duration, the session
/// is considered idle and will be cleaned up.
const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(300);

pub struct TabSession {
    pub session: Session,
    pub sftp: Sftp,
    pub channel: Channel,
    pub username: String,
    pub cancel: Arc<AtomicBool>,
    pub buffer: Arc<Mutex<String>>,
    /// Timestamp of the last `ssh_write` call from the frontend.
    pub last_activity: Arc<Mutex<Instant>>,
    /// Wake condvar — notified by `cleanup_session`/`disconnect` so threads
    /// blocked on long-interval sleeps can respond immediately.
    pub wake_cvar: Arc<Condvar>,
    /// Cached UID→username and GID→tagName mappings, populated on first SFTP
    /// directory listing so subsequent listings need 0 remote queries.
    pub uid_cache: Arc<Mutex<HashMap<i64, String>>>,
    pub gid_cache: Arc<Mutex<HashMap<i64, String>>>,
}

/// Record an emit result. Returns `true` when the frontend appears gone
/// (MAX_EMIT_FAILURES consecutive failures), signalling threads should exit.
fn emit_ok(fail_count: &AtomicU32, ok: bool) -> bool {
    if ok {
        fail_count.store(0, Ordering::Relaxed);
        false
    } else {
        fail_count.fetch_add(1, Ordering::Relaxed) + 1 >= MAX_EMIT_FAILURES
    }
}

/// RAII guard that sets the session to blocking mode on creation and restores
/// non-blocking on drop, even if an early return or panic occurs.
pub struct BlockingGuard<'a> {
    session: &'a ssh2::Session,
}

impl<'a> BlockingGuard<'a> {
    pub fn new(session: &'a ssh2::Session) -> Self {
        session.set_blocking(true);
        Self { session }
    }
}

impl<'a> Drop for BlockingGuard<'a> {
    fn drop(&mut self) {
        self.session.set_blocking(false);
    }
}

type SessionHandle = Arc<Mutex<TabSession>>;

// ── Global map keyed by tabId ──

static SESSIONS: LazyLock<RwLock<HashMap<String, SessionHandle>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

// ── do_connect (moved from core/ssh.rs) ──

fn expand_path(path: &str) -> PathBuf {
    if path.starts_with('~') {
        core::home_dir().join(&path[2..])
    } else {
        Path::new(path).to_path_buf()
    }
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

fn do_connect_inner(
    hostname: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key_path: Option<&str>,
) -> Result<(Session, String), String> {
    let addr = format!("{}:{}", hostname, port);
    let sock_addrs: Vec<_> = addr.to_socket_addrs().map_err(|e| {
        log::error!("DNS resolution failed: {}", e);
        format!("DNS resolution failed: {}", e)
    })?.collect();
    let tcp = sock_addrs
        .iter()
        .find_map(|sa| TcpStream::connect_timeout(sa, CONNECT_TIMEOUT).ok())
        .ok_or_else(|| {
            let msg = format!("TCP connection failed to {}", addr);
            log::error!("{}", msg);
            msg
        })?;
    tcp.set_read_timeout(Some(Duration::from_secs(30))).ok();
    tcp.set_write_timeout(Some(Duration::from_secs(30))).ok();

    let mut session = Session::new().map_err(|e| {
        log::error!("Failed to create session: {}", e);
        format!("Failed to create session: {}", e)
    })?;
    session.set_timeout(30_000);
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| {
        log::error!("SSH handshake failed: {}", e);
        format!("SSH handshake failed: {}", e)
    })?;

    if let Some(key_path) = private_key_path {
        let expanded = expand_path(key_path);
        session
            .userauth_pubkey_file(username, None, &expanded, password)
            .map_err(|e| {
                log::error!("Key auth failed: {}", e);
                format!("Key auth failed: {}", e)
            })?;
    } else if let Some(pwd) = password {
        session.userauth_password(username, pwd).map_err(|e| {
            log::error!("Password auth failed: {}", e);
            format!("Password auth failed: {}", e)
        })?;
    } else {
        session.userauth_agent(username).map_err(|e| {
            log::error!("Auth failed (no credentials): {}", e);
            format!("Auth failed (no credentials): {}", e)
        })?;
    }

    if !session.authenticated() {
        log::error!("Authentication failed: not authenticated");
        return Err("Authentication failed: not authenticated".to_string());
    }

    let banner = session.banner().unwrap_or("").to_string();
    Ok((session, banner))
}

pub fn do_connect(
    hostname: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key_path: Option<&str>,
) -> Result<(Session, String), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let hostname = hostname.to_string();
    let username = username.to_string();
    let password = password.map(|s| s.to_string());
    let private_key_path = private_key_path.map(|s| s.to_string());

    std::thread::spawn(move || {
        let result = do_connect_inner(&hostname, port, &username, password.as_deref(), private_key_path.as_deref());
        let _ = tx.send(result);
    });

    rx.recv_timeout(Duration::from_secs(30))
        .map_err(|_| {
            let msg = "Connection timed out".to_string();
            log::error!("{}", msg);
            msg
        })?
}

fn monitor_script() -> String {
    let parts = vec![
        r#"echo '---IP---'"#,
        r#"(hostname -I 2>/dev/null | awk '{print $1}' || ip -4 addr show scope global 2>/dev/null | awk '/inet /{print $2}' | head -1 || echo '')"#,
        r#"echo '---UPTIME---'"#,
        r#"(uptime -p 2>/dev/null || uptime 2>/dev/null | sed 's/.*up //' | sed 's/,.*//' || echo '')"#,
        r#"echo '---LOAD---'"#,
        r#"(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo '')"#,
        r#"echo '---CPU---'"#,
        r#"(top -bn1 2>/dev/null | grep -i 'Cpu(s)' | awk '{print $2+$4}' || cat /proc/stat 2>/dev/null | head -1 | awk '{print 100-($5*100/($2+$3+$4+$5+$6+$7+$8))}' || echo '')"#,
        r#"echo '---MEM---'"#,
        r#"(free -m 2>/dev/null | awk 'NR==2{printf "%dMB / %dMB (%.1f%%)\n", $3, $2, $3/$2*100}' || echo '')"#,
        r#"echo '---SWAP---'"#,
        r#"(free -m 2>/dev/null | awk 'NR==3{printf "%dMB / %dMB (%.1f%%)\n", $3, $2, $2>0?$3/$2*100:0}' || echo '')"#,
        r#"echo '---PS---'"#,
        r#"(ps aux --sort=-%mem 2>/dev/null | head -16 | tail -15 | awk '{printf "%s|%s|%s|%s\n", $4, $3, $11, $2}' || echo '')"#,
        r#"echo '---DF---'"#,
        r#"(df -h 2>/dev/null | awk 'NR>1{printf "%s|%s|%s\n", $6, $2, $4}' | grep '^/' || echo '')"#,
        r#"echo '---NET---'"#,
        r#"(cat /proc/net/dev 2>/dev/null | awk 'NR>2{rx+=$2; tx+=$10} END{printf "%d|%d\n", rx, tx}' || echo '')"#,
    ];
    parts.join(" && ")
}

fn parse_monitor_output(output: &str, tab_id: &str) -> core::models::MonitorEvent {
    let mut ip = String::new();
    let mut uptime = String::new();
    let mut load = String::new();
    let mut cpu = String::new();
    let mut memory = String::new();
    let mut swap = String::new();
    let mut net_io = String::new();
    let mut processes = Vec::new();
    let mut disks = Vec::new();

    let mut section = "";
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("---") && trimmed.ends_with("---") {
            section = trimmed.trim_start_matches("---").trim_end_matches("---");
            continue;
        }
        match section {
            "IP" => ip = trimmed.to_string(),
            "UPTIME" => uptime = trimmed.to_string(),
            "LOAD" => load = trimmed.to_string(),
            "CPU" => cpu = trimmed.to_string(),
            "MEM" => memory = trimmed.to_string(),
            "SWAP" => swap = trimmed.to_string(),
            "NET" => net_io = trimmed.to_string(),
            "PS" => {
                let parts: Vec<&str> = trimmed.split('|').collect();
                if parts.len() == 4 {
                    processes.push(core::models::ProcessInfo {
                        mem: parts[0].to_string(),
                        cpu: parts[1].to_string(),
                        command: parts[2].to_string(),
                        pid: parts[3].to_string(),
                    });
                }
            }
            "DF" => {
                let parts: Vec<&str> = trimmed.split('|').collect();
                if parts.len() == 3 {
                    disks.push(core::models::DiskInfo {
                        path: parts[0].to_string(),
                        size: parts[1].to_string(),
                        avail: parts[2].to_string(),
                    });
                }
            }
            _ => {}
        }
    }

    core::models::MonitorEvent {
        tab_id: tab_id.to_string(),
        ip,
        uptime,
        load,
        cpu,
        memory,
        swap,
        net_io,
        processes,
        disks,
    }
}

// ── Connection management ──

#[allow(clippy::too_many_arguments)]
pub fn connect(
    app_handle: &tauri::AppHandle,
    tab_id: &str,
    hostname: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key_path: Option<&str>,
    monitor_interval_secs: u64,
    heartbeat_interval_secs: u64,
) -> Result<String, String> {
    log::info!(
        "[connect] tab={} connecting to {}@{}:{}",
        tab_id,
        username,
        hostname,
        port
    );

    let (session, banner) = do_connect(hostname, port, username, password, private_key_path)?;

    log::info!("[connect] tab={} authenticated, banner={:?}", tab_id, banner);

    let sftp = session.sftp().map_err(|e| {
        log::error!("SFTP init failed: {}", e);
        format!("SFTP init failed: {}", e)
    })?;

    let mut raw_channel = session.channel_session().map_err(|e| {
        log::error!("Channel open failed: {}", e);
        format!("Channel open failed: {}", e)
    })?;
    raw_channel
        .request_pty("xterm-256color", None, Some((80, 24, 0, 0)))
        .map_err(|e| {
            log::error!("PTY request failed: {}", e);
            format!("PTY request failed: {}", e)
        })?;
    raw_channel.shell().map_err(|e| {
        log::error!("Shell start failed: {}", e);
        format!("Shell start failed: {}", e)
    })?;

    session.set_blocking(false);

    log::info!(
        "[connect] tab={} session established, starting reader/monitor/heartbeat",
        tab_id
    );

    let cancel = Arc::new(AtomicBool::new(false));
    let buffer = Arc::new(Mutex::new(String::new()));
    let fail_count = Arc::new(AtomicU32::new(0));
    let last_activity = Arc::new(Mutex::new(Instant::now()));
    let wake_mutex = Arc::new(Mutex::new(()));
    let wake_cvar = Arc::new(Condvar::new());
    let uid_cache = Arc::new(Mutex::new(HashMap::new()));
    let gid_cache = Arc::new(Mutex::new(HashMap::new()));

    let handle = Arc::new(Mutex::new(TabSession {
        session,
        sftp,
        channel: raw_channel,
        username: username.to_string(),
        cancel: cancel.clone(),
        buffer: buffer.clone(),
        last_activity: last_activity.clone(),
        wake_cvar: wake_cvar.clone(),
        uid_cache: uid_cache.clone(),
        gid_cache: gid_cache.clone(),
    }));

    // Start reader thread immediately so the SSH transport gets processed
    spawn_reader(
        app_handle.clone(),
        tab_id.to_string(),
        handle.clone(),
        buffer.clone(),
        cancel.clone(),
        fail_count.clone(),
        wake_mutex.clone(),
        wake_cvar.clone(),
    );

    // Start monitor thread
    start_monitor(
        app_handle,
        tab_id,
        handle.clone(),
        cancel.clone(),
        fail_count.clone(),
        wake_mutex.clone(),
        wake_cvar.clone(),
        monitor_interval_secs,
    );

    // Start heartbeat thread
    start_heartbeat(
        app_handle,
        tab_id,
        handle.clone(),
        cancel.clone(),
        fail_count,
        last_activity,
        wake_mutex,
        wake_cvar,
        heartbeat_interval_secs,
    );

    // Cancel any existing session with this tabId (e.g. stale reconnect session)
    {
        let mut sessions = SESSIONS.write().map_err(|e| e.to_string())?;
        if let Some(old) = sessions.remove(tab_id) {
            if let Ok(inner) = old.lock() {
                inner.cancel.store(true, Ordering::Relaxed);
                inner.wake_cvar.notify_all();
            }
        }
        sessions.insert(tab_id.to_string(), handle);
    }

    log::info!(
        "[connect] tab={} ready (active sessions: {})",
        tab_id,
        SESSIONS.read().map(|m| m.len()).unwrap_or(0)
    );

    Ok(banner)
}

pub fn get(tab_id: &str) -> Result<SessionHandle, String> {
    let sessions = SESSIONS.read().map_err(|e| e.to_string())?;
    sessions
        .get(tab_id)
        .cloned()
        .ok_or_else(|| "Session not found".to_string())
}

pub fn disconnect(tab_id: &str) -> Result<(), String> {
    log::info!("[disconnect] tab={}: disconnecting", tab_id);
    let mut sessions = SESSIONS.write().map_err(|e| e.to_string())?;
    if let Some(state) = sessions.remove(tab_id) {
        let inner = state.lock().map_err(|e| e.to_string())?;
        inner.cancel.store(true, Ordering::Relaxed);
        inner.wake_cvar.notify_all();
    }
    log::info!(
        "[disconnect] tab={}: removed (remaining sessions: {})",
        tab_id,
        sessions.len()
    );
    Ok(())
}

/// Remove a session from the global map. Safe to call from background threads
/// after `cancel` has been set — the reader/monitor/heartbeat threads will see
/// the cancel flag and exit on their next iteration.
fn cleanup_session(tab_id: &str) {
    if let Ok(mut sessions) = SESSIONS.write() {
        if let Some(state) = sessions.remove(tab_id) {
            if let Ok(inner) = state.lock() {
                inner.cancel.store(true, Ordering::Relaxed);
                inner.wake_cvar.notify_all();
            }
        }
    }
    log::info!("[cleanup] tab={}: session removed", tab_id);
}

// ── Reader thread ──

#[derive(Clone, Serialize)]
struct SshOutputEvent {
    tab_id: String,
    data: String,
}

#[allow(clippy::too_many_arguments)]
fn spawn_reader(
    app_handle: tauri::AppHandle,
    tab_id: String,
    handle: SessionHandle,
    buffer: Arc<Mutex<String>>,
    cancel: Arc<AtomicBool>,
    fail_count: Arc<AtomicU32>,
    wake_mutex: Arc<Mutex<()>>,
    wake_cvar: Arc<Condvar>,
) {
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            if cancel.load(Ordering::Relaxed) {
                break;
            }

            let output = {
                let Ok(mut inner) = handle.lock() else { break };
                match inner.channel.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => Some(String::from_utf8_lossy(&buf[..n]).to_string()),
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => None,
                    Err(e) => {
                        log::debug!("[reader] tab={}: read error, exiting: {}", tab_id, e);
                        break;
                    }
                }
            };

            if let Some(data) = output {
                if let Ok(mut b) = buffer.lock() {
                    const MAX_BUF: usize = 1_048_576;
                    if b.len() + data.len() > MAX_BUF {
                        let trim = (b.len() + data.len() - MAX_BUF).min(b.len());
                        b.drain(..trim);
                    }
                    b.push_str(&data);
                }
                let ok = app_handle
                    .emit(
                        "ssh://output",
                        SshOutputEvent {
                            tab_id: tab_id.clone(),
                            data,
                        },
                    )
                    .is_ok();
                if emit_ok(&fail_count, ok) {
                    log::warn!("[reader] tab={}: frontend unreachable, exiting", tab_id);
                    cancel.store(true, Ordering::Relaxed);
                    cleanup_session(&tab_id);
                    break;
                }
            } else {
                let Ok(guard) = wake_mutex.lock() else { break };
                let Ok((_guard, _timeout)) =
                    wake_cvar.wait_timeout(guard, Duration::from_millis(500))
                else {
                    break;
                };
            }
        }
    });
}

// ── Monitor thread ──

#[allow(clippy::too_many_arguments)]
fn start_monitor(
    app_handle: &tauri::AppHandle,
    tab_id: &str,
    handle: SessionHandle,
    cancel: Arc<AtomicBool>,
    fail_count: Arc<AtomicU32>,
    wake_mutex: Arc<Mutex<()>>,
    wake_cvar: Arc<Condvar>,
    interval_secs: u64,
) {
    let app = app_handle.clone();
    let tid = tab_id.to_string();
    let script = monitor_script();
    thread::spawn(move || {
        while !cancel.load(Ordering::Relaxed) {
            // ── Collect monitor data (try_lock to avoid blocking terminal I/O) ──
            let output = (|| -> Option<String> {
                let inner = handle.try_lock().ok()?;
                let _guard = BlockingGuard::new(&inner.session);
                inner.session.set_timeout(15_000);
                let mut buf = [0u8; 8192];
                let mut ch = inner.session.channel_session().ok()?;
                if ch.exec(&script).is_err() {
                    return None;
                }
                let mut out = String::new();
                loop {
                    match ch.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => out.push_str(&String::from_utf8_lossy(&buf[..n])),
                        Err(_) => break,
                    }
                }
                ch.wait_close().ok();
                Some(out)
            })();

            if let Some(data) = output {
                let event = parse_monitor_output(&data, &tid);
                let ok = app.emit("ssh://monitor", event).is_ok();
                if emit_ok(&fail_count, ok) {
                    log::warn!("[monitor] tab={}: frontend unreachable, exiting", tid);
                    cancel.store(true, Ordering::Relaxed);
                    cleanup_session(&tid);
                    return;
                }
            }

            // Wait for next cycle — Condvar allows immediate wake on cancel.
            // Session lock is NOT held here, so reader/writer are not blocked.
            let Ok(guard) = wake_mutex.lock() else { return };
            let Ok((_guard, _timeout)) =
                wake_cvar.wait_timeout(guard, Duration::from_secs(interval_secs))
            else {
                return;
            };
        }
    });
}

// ── Heartbeat thread ──

#[derive(Clone, Serialize)]
struct HeartbeatEvent {
    tab_id: String,
    alive: bool,
}

#[allow(clippy::too_many_arguments)]
fn start_heartbeat(
    app_handle: &tauri::AppHandle,
    tab_id: &str,
    handle: SessionHandle,
    cancel: Arc<AtomicBool>,
    fail_count: Arc<AtomicU32>,
    last_activity: Arc<Mutex<Instant>>,
    wake_mutex: Arc<Mutex<()>>,
    wake_cvar: Arc<Condvar>,
    interval_secs: u64,
) {
    let app = app_handle.clone();
    let tid = tab_id.to_string();
    let interval = interval_secs.max(1);
    thread::spawn(move || {
        let mut was_alive = true;
        loop {
            // Wait with Condvar — cancel/cleanup notifies to wake immediately.
            {
                let Ok(guard) = wake_mutex.lock() else { return };
                let Ok((_guard, _timeout)) =
                    wake_cvar.wait_timeout(guard, Duration::from_secs(interval))
                else {
                    return;
                };
            }
            if cancel.load(Ordering::Relaxed) {
                return;
            }

            // Check idle timeout
            {
                let idle = last_activity
                    .lock()
                    .map(|t| t.elapsed() >= SESSION_IDLE_TIMEOUT)
                    .unwrap_or(false);
                if idle {
                    log::info!(
                        "[heartbeat] tab={}: idle {:?}, auto-cleanup",
                        tid,
                        SESSION_IDLE_TIMEOUT
                    );
                    cancel.store(true, Ordering::Relaxed);
                    cleanup_session(&tid);
                    return;
                }
            }

            let alive = (|| -> bool {
                let inner = match handle.try_lock() {
                    Ok(g) => g,
                    Err(_) => return was_alive,
                };
                let _guard = BlockingGuard::new(&inner.session);
                let result = (|| -> Result<(), String> {
                    let mut channel = inner.session.channel_session().map_err(|_| "channel")?;
                    channel.exec("echo 1").map_err(|_| "exec")?;
                    channel.wait_close().ok();
                    Ok(())
                })();
                drop(_guard);
                result.is_ok()
            })();

            log::debug!("[heartbeat] tab={} alive={}", tid, alive);

            if alive != was_alive {
                was_alive = alive;
                let ok = app
                    .emit(
                        "ssh://heartbeat",
                        HeartbeatEvent {
                            tab_id: tid.clone(),
                            alive,
                        },
                    )
                    .is_ok();
                if emit_ok(&fail_count, ok) {
                    log::warn!("[heartbeat] tab={}: frontend unreachable, exiting", tid);
                    cancel.store(true, Ordering::Relaxed);
                    cleanup_session(&tid);
                    return;
                }
            }
        }
    });
}

// ── SSH operations ──

pub fn write(tab_id: &str, data: &str) -> Result<(), String> {
    let handle = get(tab_id)?;
    let mut inner = handle.lock().map_err(|e| e.to_string())?;
    // Refresh activity timestamp so idle-timeout is pushed back
    if let Ok(mut t) = inner.last_activity.lock() {
        *t = Instant::now();
    }
    inner.channel.write_all(data.as_bytes()).map_err(|e| {
        log::error!("Write failed: {}", e);
        format!("Write failed: {}", e)
    })
}

pub fn read(tab_id: &str) -> Result<String, String> {
    let handle = get(tab_id)?;
    let inner = handle.lock().map_err(|e| e.to_string())?;
    let mut buffered = inner.buffer.lock().map_err(|e| e.to_string())?;
    let mut output = String::new();
    std::mem::swap(&mut output, &mut *buffered);
    Ok(output)
}

pub fn execute(tab_id: &str, command: &str) -> Result<core::models::SshExecuteResult, String> {
    let handle = get(tab_id)?;
    let inner = handle.lock().map_err(|e| e.to_string())?;

    let session = &inner.session;
    let _guard = BlockingGuard::new(session);
    session.set_timeout(30_000);

    let mut channel = session.channel_session().map_err(|e| {
        log::error!("Channel open failed: {}", e);
        format!("Channel open failed: {}", e)
    })?;
    channel.exec(command).map_err(|e| {
        log::error!("Exec failed: {}", e);
        format!("Exec failed: {}", e)
    })?;

    let mut output = String::new();
    let mut buf = [0u8; 8192];
    loop {
        match channel.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => output.push_str(&String::from_utf8_lossy(&buf[..n])),
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                const POLL_DELAY: Duration = Duration::from_millis(10);
                thread::sleep(POLL_DELAY);
                continue;
            }
            Err(_) => break,
        }
    }

    channel.wait_close().ok();
    let exit_code = channel.exit_status().unwrap_or(-1);

    Ok(core::models::SshExecuteResult {
        tab_id: tab_id.to_string(),
        exit_code,
        output,
    })
}
