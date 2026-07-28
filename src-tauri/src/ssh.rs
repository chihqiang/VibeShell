use crate::core;

#[tauri::command]
pub fn ssh_test_connect(
    hostname: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key_path: Option<String>,
) -> Result<String, String> {
    log::info!(
        "[ssh] test-connect to {}@{}:{}",
        username,
        hostname,
        port
    );
    let (_, banner) = core::session::do_connect(
        &hostname,
        port,
        &username,
        password.as_deref(),
        private_key_path.as_deref(),
    )?;
    log::info!("[ssh] test-connect succeeded, banner={:?}", banner);
    Ok(banner)
}

#[tauri::command]
pub fn ssh_quick_connect(
    app_handle: tauri::AppHandle,
    tab_id: String,
    hostname: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key_path: Option<String>,
    monitor_interval_secs: Option<u64>,
    heartbeat_interval_secs: Option<u64>,
) -> Result<core::models::SshConnectResult, String> {
    let banner = core::session::connect(
        &app_handle,
        &tab_id,
        &hostname,
        port,
        &username,
        password.as_deref(),
        private_key_path.as_deref(),
        monitor_interval_secs.unwrap_or(4),
        heartbeat_interval_secs.unwrap_or(10),
    )?;
    Ok(core::models::SshConnectResult {
        id: tab_id,
        banner,
    })
}

#[tauri::command]
pub fn ssh_connect(
    app_handle: tauri::AppHandle,
    tab_id: String,
    host_id: String,
    monitor_interval_secs: Option<u64>,
    heartbeat_interval_secs: Option<u64>,
) -> Result<core::models::SshConnectResult, String> {
    log::info!("[ssh] connect tab={} host_id={}", tab_id, host_id);

    // 从 DB 查询主机配置
    let host = core::store::get_host(&host_id)?;

    // 决定连接密码：密钥认证用密钥短语，密码认证用主机密码
    let auth_password: Option<String> = if host.auth_method == "key" {
        if let Some(ref key_id) = host.key_id {
            let key = core::store::get_key(key_id)?
                .ok_or_else(|| format!("Key not found: id={}", key_id))?;
            key.password
        } else {
            return Err("Auth method is 'key' but no key_id is set".to_string());
        }
    } else {
        host.password.clone()
    };

    // 密钥认证时，private_key_path 用密钥内容（直接作为临时文件写入）
    let private_key_content: Option<String> = if host.auth_method == "key" {
        if let Some(ref key_id) = host.key_id {
            let key = core::store::get_key(key_id)?
                .ok_or_else(|| format!("Key not found: id={}", key_id))?;
            Some(key.content)
        } else {
            None
        }
    } else {
        None
    };

    let monitor_interval = monitor_interval_secs.unwrap_or(4);
    let heartbeat_interval = heartbeat_interval_secs.unwrap_or(10);

    let banner = core::session::connect(
        &app_handle,
        &tab_id,
        &host.hostname,
        host.port,
        &host.username,
        auth_password.as_deref(),
        private_key_content.as_deref(),
        monitor_interval,
        heartbeat_interval,
    )?;

    Ok(core::models::SshConnectResult {
        id: tab_id,
        banner,
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
