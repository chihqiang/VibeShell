mod backup;
mod core;
mod fs;
mod key;
mod logger;
mod sftp;
mod ssh;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = core::data_dir();
    std::fs::create_dir_all(&data_dir)
        .unwrap_or_else(|e| eprintln!("Warning: failed to create data dir: {}", e));

    let log_file = core::log_path();
    if let Some(parent) = log_file.parent() {
        std::fs::create_dir_all(parent)
            .unwrap_or_else(|e| eprintln!("Warning: failed to create log dir: {}", e));
        // If creation failed, log_file may still be writable.
        // Attempt to touch it now so that fern::log_file succeeds.
        // If this also fails, we log a warning and skip file logging.
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(&log_file);
    }

    // Rotate log file if it exceeds the size limit
    logger::rotate_log_if_needed(&log_file);

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} [{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                message,
            ))
        })
        .level(log::LevelFilter::Debug)
        .chain(std::io::stdout())
        // Reduce verbosity of ssh2 library to avoid excessive logging
        .level_for("ssh2", log::LevelFilter::Warn)
        .chain(match fern::log_file(&log_file) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Warning: failed to open {}: {}", log_file.display(), e);
                // Fallback: create the file fresh to avoid app crash
                std::fs::File::create(&log_file).expect("cannot create log file")
            }
        })
        .apply()
        .unwrap_or_else(|e| eprintln!("Warning: failed to initialize logger: {}", e));

    log::info!("vibeshell starting, data_dir={}", data_dir.display());

    if let Err(e) = core::store::init(&data_dir) {
        log::error!("vibeshell database init failed: {}", e);
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
    }
    log::info!("vibeshell database initialized");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            // Frontend logging
            logger::log_message,
            // Storage commands
            storage::save_ssh_defaults,
            storage::list_hosts,
            storage::save_host,
            storage::delete_host,
            storage::get_app_config,
            storage::count_hosts,
            storage::list_tags,
            // SSH commands
            ssh::ssh_connect,
            ssh::ssh_quick_connect,
            ssh::ssh_test_connect,
            ssh::ssh_execute,
            ssh::ssh_disconnect,
            ssh::ssh_write,
            ssh::ssh_read,
            // SFTP commands
            sftp::sftp_list_files,
            sftp::sftp_list_files_recursive,
            sftp::sftp_download_file,
            sftp::sftp_upload_file,
            sftp::sftp_delete_file,
            sftp::sftp_rename,
            sftp::sftp_create_dir,
            sftp::sftp_chmod,
            sftp::sftp_get_users_groups,
            sftp::sftp_create_file,
            sftp::sftp_read_file,
            sftp::sftp_write_file,
            sftp::sftp_upload_file_progress,
            sftp::sftp_download_file_progress,
            sftp::sftp_cancel_transfer,
            sftp::sftp_list_local_files,
            sftp::sftp_is_directory,
            // Local filesystem
            fs::list_local_files,
            key::get_key_referrers,
            key::list_keys,
            key::import_key,
            key::import_key_content,
            key::delete_key,
            // Backup / Restore
            backup::backup_data,
            backup::restore_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
