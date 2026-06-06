mod backup;
mod core;
mod fs;
mod hotkey;
mod key;
mod logger;
mod sftp;
mod ssh;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = core::data_dir();
    std::fs::create_dir_all(&data_dir).ok();

    let log_file = core::log_path();
    if let Some(parent) = log_file.parent() {
        std::fs::create_dir_all(parent).ok();
    }

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
        .chain(match fern::log_file(&log_file) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Warning: failed to open {}: {}", log_file.display(), e);
                return;
            }
        })
        .apply()
        .unwrap_or_else(|e| {
            eprintln!("Warning: failed to initialize logger: {}", e);
        });

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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            hotkey::register_all_global_shortcuts(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Frontend logging
            logger::log_message,
            // Storage commands
            storage::save_ssh_defaults,
            storage::list_hosts,
            storage::save_host,
            storage::delete_host,
            storage::get_app_config,
            storage::list_groups,
            storage::save_group,
            storage::delete_group,
            // SSH commands
            ssh::ssh_connect,
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
            sftp::sftp_upload_file_resume,
            sftp::sftp_download_file_progress,
            sftp::sftp_cancel_transfer,
            sftp::sftp_list_local_files,
            sftp::sftp_is_directory,
            // Local filesystem
            fs::list_local_files,
            key::list_keys,
            key::import_key,
            key::import_key_content,
            key::delete_key,
            // Hotkey config
            hotkey::load_hotkeys,
            hotkey::save_hotkeys,
            // Backup / Restore
            backup::backup_data,
            backup::restore_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
