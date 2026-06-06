use crate::core;

#[tauri::command]
pub fn list_keys() -> Result<Vec<core::models::KeyEntry>, String> {
    core::key::list_keys()
}

#[tauri::command]
pub fn import_key(
    source_path: String,
    name: Option<String>,
    password: Option<String>,
) -> Result<core::models::KeyEntry, String> {
    log::info!(
        "[key] import from file: path={} name={:?} has_password={}",
        source_path,
        name,
        password.is_some()
    );
    core::key::import_key(source_path, name, password)
}

#[tauri::command]
pub fn import_key_content(
    content: String,
    name: String,
    password: Option<String>,
) -> Result<core::models::KeyEntry, String> {
    log::info!(
        "[key] import from content: name={} len={} has_password={}",
        name,
        content.len(),
        password.is_some()
    );
    core::key::import_key_content(content, name, password)
}

#[tauri::command]
pub fn delete_key(id: String) -> Result<(), String> {
    log::info!("[key] delete key: id={}", id);
    core::key::delete_key(id)
}
