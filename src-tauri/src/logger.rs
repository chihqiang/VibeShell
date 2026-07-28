use std::path::Path;

/// Maximum log file size before rotation (10MB)
const MAX_LOG_FILE_SIZE: u64 = 10 * 1024 * 1024;
/// Maximum number of rotated log files to keep
const MAX_LOG_FILES: usize = 3;

/// Rotate log files if the current log file exceeds MAX_LOG_FILE_SIZE.
/// Keeps up to MAX_LOG_FILES rotated files with suffixes .1, .2, .3, etc.
///
/// This function uses `eprintln!` instead of `log::warn!` because it may
/// be called before the global logger is initialized.
pub fn rotate_log_if_needed(log_file: &Path) {
    let metadata = match std::fs::metadata(log_file) {
        Ok(meta) => meta,
        Err(_) => return,
    };
    if metadata.len() < MAX_LOG_FILE_SIZE {
        return;
    }

    eprintln!(
        "Rotating log file: {} (size: {} bytes)",
        log_file.display(),
        metadata.len()
    );

    // Remove oldest log file if it exists
    let oldest = log_file.with_extension(format!("log.{}", MAX_LOG_FILES));
    let _ = std::fs::remove_file(&oldest);

    // Rotate existing log files: log.N -> log.(N+1)
    for i in (1..MAX_LOG_FILES).rev() {
        let current = log_file.with_extension(format!("log.{}", i));
        let next = log_file.with_extension(format!("log.{}", i + 1));
        let _ = std::fs::rename(&current, &next);
    }

    // Move current log to log.1
    let rotated = log_file.with_extension("log.1");
    let _ = std::fs::rename(log_file, &rotated);
}

#[tauri::command]
pub fn log_message(level: String, message: String) {
    match level.to_lowercase().as_str() {
        "error" => log::error!("[frontend] {message}"),
        "warn" => log::warn!("[frontend] {message}"),
        "info" => log::info!("[frontend] {message}"),
        "debug" => log::debug!("[frontend] {message}"),
        "trace" => log::trace!("[frontend] {message}"),
        _ => log::info!("[frontend] {message}"),
    }
}
