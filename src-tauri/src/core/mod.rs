pub mod backup;
pub mod store;
pub mod fs;
pub mod key;
pub mod models;
pub mod session;
pub mod sftp;

use std::path::PathBuf;

/// Shared I/O buffer/chunk size used by sftp transfers and backup zip streaming.
pub const CHUNK_SIZE: usize = 256 * 1024;

/// Shared permission mode formatter (avoids duplication between sftp.rs and fs.rs).
pub fn format_mode(mode: u32) -> String {
    let file_type = match mode & 0o170000 {
        0o010000 => "p", // FIFO / named pipe
        0o020000 => "c", // character device
        0o040000 => "d", // directory
        0o060000 => "b", // block device
        0o100000 => "-", // regular file
        0o120000 => "l", // symbolic link
        0o140000 => "s", // socket
        _ => "?",        // unknown
    };
    let user = format!(
        "{}{}{}",
        if mode & 0o400 != 0 { "r" } else { "-" },
        if mode & 0o200 != 0 { "w" } else { "-" },
        if mode & 0o100 != 0 { "x" } else { "-" },
    );
    let group = format!(
        "{}{}{}",
        if mode & 0o040 != 0 { "r" } else { "-" },
        if mode & 0o020 != 0 { "w" } else { "-" },
        if mode & 0o010 != 0 { "x" } else { "-" },
    );
    let other = format!(
        "{}{}{}",
        if mode & 0o004 != 0 { "r" } else { "-" },
        if mode & 0o002 != 0 { "w" } else { "-" },
        if mode & 0o001 != 0 { "x" } else { "-" },
    );
    format!("{}{}{}{}", file_type, user, group, other)
}

/// Shared data directory for all vibeshell persistence.
pub fn data_dir() -> PathBuf {
    home_dir().join(".vibeshell")
}

/// SSH key storage directory: `$DATA_DIR/keys`
pub fn keys_path() -> PathBuf {
    data_dir().join("keys")
}

/// Daily-rotated log file path: `$DATA_DIR/log/YYYY-MM-DD.log`
pub fn log_path() -> PathBuf {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    data_dir().join("log").join(format!("{}.log", today))
}

/// Cross-platform home directory (replaces unmaintained `dirs` crate).
pub fn home_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home);
    }
    #[cfg(target_os = "windows")]
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return PathBuf::from(profile);
    }
    PathBuf::from("/")
}
