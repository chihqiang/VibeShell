mod core;
mod key;
mod sftp;
mod ssh;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = core::data_dir();
    std::fs::create_dir_all(&data_dir)
        .unwrap_or_else(|e| eprintln!("Warning: failed to create data dir: {}", e));

    log::info!("vibeshell starting, data_dir={}", data_dir.display());

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        // 统一日志：tauri-plugin-log 接管全局 logger（替换原 fern 方案）。
        // 前端可通过 @tauri-apps/plugin-log 直接打日志，与 Rust 端 log::info! 等
        // 汇入同一日志管线（Stdout + LogDir 文件，10MB 轮转保留 3 份）。
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Debug)
                .level_for("ssh2", tauri_plugin_log::log::LevelFilter::Warn)
                .max_file_size(10 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            // SSH commands
            ssh::ssh_quick_connect,
            ssh::ssh_test_connect,
            ssh::proxy_test_connect,
            ssh::ssh_execute,
            ssh::ssh_disconnect,
            ssh::ssh_write,
            ssh::ssh_read,
            // SFTP commands
            sftp::sftp_list_files,
            sftp::sftp_list_files_recursive,
            sftp::sftp_delete_file,
            sftp::sftp_rename,
            sftp::sftp_create_dir,
            sftp::sftp_chmod,
            sftp::sftp_get_users_groups,
            sftp::sftp_create_file,
            sftp::sftp_read_file,
            sftp::sftp_write_file,
            sftp::sftp_stat_remote,
            sftp::sftp_write_chunk,
            sftp::sftp_read_chunk,
            // Keys
            key::import_key,
            key::import_key_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
