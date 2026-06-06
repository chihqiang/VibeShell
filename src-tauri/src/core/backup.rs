use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::io::Write;
use std::path::Path;

use super::store;
use super::CHUNK_SIZE;
use super::models::{HostConfig, HotkeyBinding, KeyEntry};

pub fn backup_data(data_dir: &Path, destination: &str) -> Result<(), String> {
    if !data_dir.exists() {
        return Err("Data directory does not exist, nothing to backup".to_string());
    }

    log::info!("[backup] starting backup to {}", destination);

    let file = fs::File::create(destination)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(&mut zip, data_dir, data_dir, &options)?;
    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    log::info!("[backup] completed: {}", destination);
    Ok(())
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<fs::File>,
    base: &Path,
    dir: &Path,
    options: &zip::write::SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if name == "log" || name.starts_with("log/") {
            continue;
        }

        if path.is_dir() {
            zip.add_directory(&name, *options)
                .map_err(|e| format!("Failed to add dir to zip: {}", e))?;
            add_dir_to_zip(zip, base, &path, options)?;
        } else {
            let mut file =
                fs::File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
            zip.start_file(&name, *options)
                .map_err(|e| format!("Failed to add file to zip: {}", e))?;
            let mut buf = vec![0u8; CHUNK_SIZE];
            loop {
                let n = file
                    .read(&mut buf)
                    .map_err(|e| format!("Failed to read file: {}", e))?;
                if n == 0 {
                    break;
                }
                zip.write_all(&buf[..n])
                    .map_err(|e| format!("Failed to write file to zip: {}", e))?;
            }
        }
    }
    Ok(())
}

pub fn restore_data(source: &str, data_dir: &Path) -> Result<(), String> {
    log::info!("[restore] starting restore from {}", source);

    let tmp_dir =
        std::env::temp_dir().join(format!("vibeshell_restore_{}", uuid::Uuid::new_v4()));

    let file =
        fs::File::open(source).map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    log::info!("[restore] extracting {} zip entries", archive.len());
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        let entry_name = entry.name().to_string();
        if entry_name.is_empty() || entry_name.contains("..") {
            continue;
        }
        let target = tmp_dir.join(&entry_name);

        if entry.is_dir() {
            fs::create_dir_all(&target)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let mut content = Vec::new();
            entry
                .read_to_end(&mut content)
                .map_err(|e| format!("Failed to read zip entry content: {}", e))?;
            fs::write(&target, &content)
                .map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }
    }

    let result = (|| -> Result<(), String> {
        // ── Merge hosts ──
        let hosts_path = tmp_dir.join("hosts.json");
        if hosts_path.exists() {
            let raw = fs::read_to_string(&hosts_path)
                .map_err(|e| format!("Failed to read hosts.json: {}", e))?;
            let parsed: Vec<HostConfig> = serde_json::from_str(&raw)
                .map_err(|e| format!("Failed to parse hosts.json: {}", e))?;
            log::info!("[restore] merging {} hosts", parsed.len());
            store::import_hosts(&parsed)?;
        }

        // ── Merge groups ──
        let groups_path = tmp_dir.join("groups.json");
        if groups_path.exists() {
            let raw = fs::read_to_string(&groups_path)
                .map_err(|e| format!("Failed to read groups.json: {}", e))?;
            let parsed: Vec<String> = serde_json::from_str(&raw)
                .map_err(|e| format!("Failed to parse groups.json: {}", e))?;
            log::info!("[restore] merging {} groups", parsed.len());
            store::import_groups(&parsed)?;
        }

        // ── Merge keys ──
        let keys_path = tmp_dir.join("keys.json");
        if keys_path.exists() {
            let raw = fs::read_to_string(&keys_path)
                .map_err(|e| format!("Failed to read keys.json: {}", e))?;
            let parsed: Vec<KeyEntry> = serde_json::from_str(&raw)
                .map_err(|e| format!("Failed to parse keys.json: {}", e))?;
            log::info!("[restore] merging {} keys", parsed.len());
            store::import_keys(&parsed)?;
        }

        // ── Merge hotkeys ──
        let hotkeys_path = tmp_dir.join("hotkeys.json");
        if hotkeys_path.exists() {
            let raw = fs::read_to_string(&hotkeys_path)
                .map_err(|e| format!("Failed to read hotkeys.json: {}", e))?;
            let parsed: HashMap<String, HotkeyBinding> = serde_json::from_str(&raw)
                .map_err(|e| format!("Failed to parse hotkeys.json: {}", e))?;
            log::info!("[restore] merging {} hotkeys", parsed.len());
            store::import_hotkeys(parsed)?;
        }

        // ── Merge config ──
        let config_path = tmp_dir.join("config.json");
        if config_path.exists() {
            let raw = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read config.json: {}", e))?;
            let parsed: HashMap<String, String> = serde_json::from_str(&raw)
                .map_err(|e| format!("Failed to parse config.json: {}", e))?;
            log::info!("[restore] merging config ({} keys)", parsed.len());
            store::import_config(parsed)?;
        }

        // ── Copy key files ──
        let tmp_keys_dir = tmp_dir.join("keys");
        let dst_keys_dir = data_dir.join("keys");
        if tmp_keys_dir.exists() {
            fs::create_dir_all(&dst_keys_dir).map_err(|e| e.to_string())?;
            let mut count = 0;
            for entry in fs::read_dir(&tmp_keys_dir)
                .map_err(|e| format!("Failed to read tmp keys dir: {}", e))?
            {
                let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                let path = entry.path();
                if path.is_file() {
                    let name = path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown");
                    let dest = dst_keys_dir.join(name);
                    fs::copy(&path, &dest)
                        .map_err(|e| format!("Failed to copy key file {}: {}", name, e))?;
                    count += 1;
                }
            }
            log::info!("[restore] copied {} key files", count);
        }

        Ok(())
    })();

    fs::remove_dir_all(&tmp_dir).ok();
    if result.is_ok() {
        log::info!("[restore] completed from {}", source);
    }
    result
}
