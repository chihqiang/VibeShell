use crate::core;

#[tauri::command]
pub fn backup_data(destination: String) -> Result<(), String> {
    core::backup::backup_data(&core::data_dir(), &destination)
}

#[tauri::command]
pub fn restore_data(source: String) -> Result<(), String> {
    core::backup::restore_data(&source, &core::data_dir())
}
