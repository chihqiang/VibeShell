use crate::core;

/// 测试代理连通性。async + spawn_blocking：阻塞逻辑放到线程池，
/// 避免同步命令阻塞主线程导致 UI 冻结。
#[tauri::command]
pub async fn proxy_test_connect(
    hostname: String,
    port: u16,
    username: String,
    password: String,
) -> Result<String, String> {
    log::info!("[proxy] test-connect {}:{}", hostname, port);
    tauri::async_runtime::spawn_blocking(move || {
        core::session::test_proxy(&hostname, port, &username, &password)
    })
    .await
    .map_err(|e| format!("代理测试任务异常: {}", e))?
}

/// 测试 SSH 连接。async + spawn_blocking：握手等阻塞操作不占主线程。
#[tauri::command]
pub async fn ssh_test_connect(
    hostname: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key_path: Option<String>,
    proxy: Option<core::models::ProxyConfig>,
) -> Result<String, String> {
    log::info!("[ssh] test-connect to {}@{}:{}", username, hostname, port);
    let handle = tauri::async_runtime::spawn_blocking(move || {
        core::session::do_connect(
            &hostname,
            port,
            &username,
            password.as_deref(),
            private_key_path.as_deref(),
            proxy.as_ref(),
        )
    });
    let (_, banner) = handle
        .await
        .map_err(|e| format!("SSH 测试任务异常: {}", e))??;
    log::info!("[ssh] test-connect succeeded, banner={:?}", banner);
    Ok(banner)
}

#[tauri::command]
pub async fn ssh_quick_connect(
    app_handle: tauri::AppHandle,
    tab_id: String,
    hostname: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key_path: Option<String>,
    monitor_interval_secs: Option<u64>,
    heartbeat_interval_secs: Option<u64>,
    idle_timeout_secs: Option<u64>,
    proxy: Option<core::models::ProxyConfig>,
) -> Result<core::models::SshConnectResult, String> {
    // 建连包含 TCP 握手 + SSH 握手 + OS 检测等阻塞操作，可能耗时数秒；
    // async + spawn_blocking 避免阻塞主线程导致 UI 冻结。
    let tab_id_for_connect = tab_id.clone();
    let proxy_for_connect = proxy.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        core::session::connect(
            &app_handle,
            &tab_id_for_connect,
            &hostname,
            port,
            &username,
            password.as_deref(),
            private_key_path.as_deref(),
            monitor_interval_secs
                .unwrap_or(core::models::SshDefaults::DEFAULT_MONITOR_INTERVAL as u64),
            heartbeat_interval_secs
                .unwrap_or(core::models::SshDefaults::DEFAULT_HEARTBEAT_INTERVAL as u64),
            idle_timeout_secs
                .unwrap_or(core::models::SshDefaults::DEFAULT_IDLE_TIMEOUT as u64),
            proxy_for_connect.as_ref(),
        )
    })
    .await
    .map_err(|e| format!("SSH 连接任务异常: {}", e))??;
    let banner = result;
    // 与 session.rs 内部 use_proxy 判断保持一致，计算实际连接通道
    let via_proxy = proxy
        .as_ref()
        .filter(|p| p.enabled && p.r#type != core::models::ProxyType::None && !p.host.is_empty())
        .map(|p| format!("{}:{}", p.host, p.port));
    log::info!(
        "[ssh] connected tab={} via {}",
        tab_id,
        via_proxy.as_deref().unwrap_or("direct")
    );
    Ok(core::models::SshConnectResult {
        id: tab_id,
        banner,
        via_proxy,
    })
}

#[tauri::command]
pub fn ssh_write(tab_id: String, data: String) -> Result<(), String> {
    core::session::write(&tab_id, &data)
}

#[tauri::command]
pub fn ssh_read(tab_id: String) -> Result<String, String> {
    core::session::read(&tab_id)
}

#[tauri::command]
pub fn ssh_execute(
    tab_id: String,
    command: String,
) -> Result<core::models::SshExecuteResult, String> {
    log::debug!("[ssh] execute on tab={}: {}", tab_id, command);
    core::session::execute(&tab_id, &command)
}

#[tauri::command]
pub fn ssh_disconnect(tab_id: String) -> Result<(), String> {
    log::info!("[ssh] disconnect tab={}", tab_id);
    core::session::disconnect(&tab_id)
}
