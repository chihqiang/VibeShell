use std::path::PathBuf;
use uuid::Uuid;

use super::models::KeyEntry;
use super::store;

fn detect_key_type(content: &str) -> String {
    if content.contains("BEGIN RSA PRIVATE KEY") {
        return "RSA".to_string();
    }
    if content.contains("BEGIN EC PRIVATE KEY") {
        return "ECDSA".to_string();
    }
    if content.contains("BEGIN OPENSSH PRIVATE KEY") {
        return "OPENSSH".to_string();
    }
    if content.contains("BEGIN DSA PRIVATE KEY") {
        return "DSA".to_string();
    }
    "UNKNOWN".to_string()
}

fn create_entry(name: String, password: Option<String>, content: &str) -> Result<KeyEntry, String> {
    let key_type = detect_key_type(content);
    let entry = KeyEntry {
        id: Uuid::new_v4().to_string(),
        name,
        key_type,
        password,
        content: content.to_string(),
    };
    store::insert_key(&entry)?;
    Ok(entry)
}

pub fn list_keys() -> Result<Vec<KeyEntry>, String> {
    store::list_keys()
}

pub fn import_key(
    source_path: String,
    name: Option<String>,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    let expanded = if source_path.starts_with('~') {
        let home = super::home_dir();
        PathBuf::from(home).join(&source_path[2..])
    } else {
        PathBuf::from(&source_path)
    };

    let path = std::path::Path::new(&expanded);
    if !path.exists() {
        log::error!("File not found: {}", expanded.display());
        return Err(format!("File not found: {}", expanded.display()));
    }

    let original_name = name.unwrap_or_else(|| {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    });

    let content = std::fs::read_to_string(&expanded).map_err(|e| {
        log::error!("Failed to read key file: {}", e);
        format!("Failed to read key file: {}", e)
    })?;

    create_entry(original_name, password, &content)
}

pub fn import_key_content(
    content: String,
    name: String,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    create_entry(name, password, &content)
}

pub fn delete_key(id: String) -> Result<(), String> {
    let _entry = store::delete_key(&id)?;
    Ok(())
}
