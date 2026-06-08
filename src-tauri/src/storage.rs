use crate::core;

#[tauri::command]
pub fn save_ssh_defaults(defaults: core::models::SshDefaults) -> Result<(), String> {
    log::info!(
        "[config] save ssh defaults: hostname={} port={} user={}",
        defaults.hostname,
        defaults.port,
        defaults.username
    );
    core::store::save_ssh_defaults(&defaults)
}

#[tauri::command]
pub fn list_hosts() -> Result<Vec<core::models::HostConfig>, String> {
    core::store::list_hosts()
}

#[tauri::command]
pub fn save_host(host: core::models::HostConfig) -> Result<core::models::HostConfig, String> {
    log::info!(
        "[host] save host: name={} hostname={} port={} user={} id={}",
        host.name,
        host.hostname,
        host.port,
        host.username,
        if host.id.is_empty() { "<new>" } else { &host.id }
    );
    core::store::save_host(host)
}

#[tauri::command]
pub fn delete_host(id: String) -> Result<(), String> {
    log::info!("[host] delete host: id={}", id);
    core::store::delete_host(id)
}

#[tauri::command]
pub fn get_app_config() -> core::models::AppConfig {
    core::store::get_app_config(&core::data_dir())
}

#[tauri::command]
pub fn list_tags() -> Result<Vec<String>, String> {
    core::store::list_tags()
}
