use std::fs;

use super::models::BackupPayload;
use super::store;

pub fn backup_data(destination: &str) -> Result<(), String> {
    store::sync_barrier()?;
    log::info!("[backup] exporting to {}", destination);

    let payload = store::export_backup()?;
    let json =
        serde_json::to_string_pretty(&payload).map_err(|e| format!("serialize backup: {}", e))?;

    fs::write(destination, &json).map_err(|e| format!("write backup: {}", e))?;

    log::info!(
        "[backup] completed: {} ({} hosts, {} keys)",
        destination,
        payload.hosts.len(),
        payload.keys.len()
    );
    Ok(())
}

pub fn restore_data(source: &str) -> Result<(), String> {
    log::info!("[restore] importing from {}", source);

    let json = fs::read_to_string(source).map_err(|e| format!("read backup: {}", e))?;

    let payload: BackupPayload =
        serde_json::from_str(&json).map_err(|e| format!("parse backup: {}", e))?;

    let host_count = payload.hosts.len();
    let key_count = payload.keys.len();
    let config_count = payload.config.len();

    store::import_backup(payload)?;

    log::info!(
        "[restore] completed: {} hosts, {} keys, {} config entries",
        host_count,
        key_count,
        config_count
    );
    Ok(())
}
