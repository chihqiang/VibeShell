use crate::core;

#[tauri::command]
pub fn list_local_files(path: String) -> Result<Vec<core::models::FileEntry>, String> {
    core::fs::list_local_files(path)
}
