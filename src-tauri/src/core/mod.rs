pub mod backup;
pub mod store;
pub mod fs;
pub mod key;
pub mod models;
pub mod session;
pub mod sftp;

use std::path::PathBuf;
use std::sync::OnceLock;

/// Shared I/O buffer/chunk size used by sftp transfers and backup zip streaming.
pub const CHUNK_SIZE: usize = 256 * 1024;

/// Shared permission mode formatter (avoids duplication between sftp.rs and fs.rs).
pub fn format_mode(mode: u32) -> String {
    let ft = match mode & 0o170000 {
        0o010000 => 'p',
        0o020000 => 'c',
        0o040000 => 'd',
        0o060000 => 'b',
        0o100000 => '-',
        0o120000 => 'l',
        0o140000 => 's',
        _ => '?',
    };
    macro_rules! bit {
        ($mask:expr, $ch:expr) => {
            if mode & $mask != 0 { $ch } else { '-' }
        };
    }
    let mut s = String::with_capacity(10);
    s.push(ft);
    s.push(bit!(0o400, 'r'));
    s.push(bit!(0o200, 'w'));
    s.push(bit!(0o100, 'x'));
    s.push(bit!(0o040, 'r'));
    s.push(bit!(0o020, 'w'));
    s.push(bit!(0o010, 'x'));
    s.push(bit!(0o004, 'r'));
    s.push(bit!(0o002, 'w'));
    s.push(bit!(0o001, 'x'));
    s
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

static HOME_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Cross-platform home directory (replaces unmaintained `dirs` crate).
pub fn home_dir() -> PathBuf {
    HOME_DIR
        .get_or_init(|| {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home);
            }
            #[cfg(target_os = "windows")]
            if let Ok(profile) = std::env::var("USERPROFILE") {
                return PathBuf::from(profile);
            }
            PathBuf::from("/")
        })
        .clone()
}
