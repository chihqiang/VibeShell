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
#[allow(clippy::too_many_arguments)]
pub fn ssh_connect(
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
        monitor_interval_secs.unwrap_or(4).max(1),
        heartbeat_interval_secs.unwrap_or(30).max(3),
    )?;
    Ok(core::models::SshConnectResult { id: tab_id, banner })
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
