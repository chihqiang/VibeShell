use std::fs;

use super::models::FileEntry;

// ── Platform-specific metadata extraction ──

#[cfg(unix)]
mod platform {
    use std::collections::HashMap;
    use std::os::unix::fs::{MetadataExt, PermissionsExt};
    use std::sync::LazyLock;

    static PASSWD: LazyLock<HashMap<u32, String>> = LazyLock::new(|| {
        let mut map = HashMap::new();
        if let Ok(content) = std::fs::read_to_string("/etc/passwd") {
            for line in content.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    if let Ok(uid) = parts[2].parse::<u32>() {
                        map.insert(uid, parts[0].to_string());
                    }
                }
            }
        }
        map
    });

    static GROUP: LazyLock<HashMap<u32, String>> = LazyLock::new(|| {
        let mut map = HashMap::new();
        if let Ok(content) = std::fs::read_to_string("/etc/group") {
            for line in content.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    if let Ok(gid) = parts[2].parse::<u32>() {
                        map.insert(gid, parts[0].to_string());
                    }
                }
            }
        }
        map
    });

    pub fn uid(meta: &std::fs::Metadata) -> u32 {
        meta.uid()
    }

    pub fn gid(meta: &std::fs::Metadata) -> u32 {
        meta.gid()
    }

    pub fn perm(mode: &std::fs::Permissions) -> u32 {
        mode.mode()
    }

    pub fn format_mode(meta: &std::fs::Metadata) -> String {
        super::super::format_mode(meta.permissions().mode())
    }

    pub fn resolve_user(uid: u32) -> String {
        PASSWD.get(&uid).cloned().unwrap_or_else(|| uid.to_string())
    }

    pub fn resolve_group(gid: u32) -> String {
        GROUP.get(&gid).cloned().unwrap_or_else(|| gid.to_string())
    }
}

#[cfg(not(unix))]
mod platform {
    pub fn uid(_meta: &std::fs::Metadata) -> u32 {
        0
    }

    pub fn gid(_meta: &std::fs::Metadata) -> u32 {
        0
    }

    pub fn perm(_mode: &std::fs::Permissions) -> u32 {
        0o644
    }

    pub fn format_mode(meta: &std::fs::Metadata) -> String {
        let file_type = if meta.is_dir() { "d" } else { "-" };
        let perms = if meta.permissions().readonly() {
            "r--r--r--"
        } else {
            "rw-r--r--"
        };
        format!("{}{}", file_type, perms)
    }

    pub fn resolve_user(_uid: u32) -> String {
        String::new()
    }

    pub fn resolve_group(_gid: u32) -> String {
        String::new()
    }
}

// ── Main ──

pub fn list_local_files(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        log::error!("Path is not a directory");
        return Err("Path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| {
        log::error!("Failed to read directory: {}", e);
        format!("Failed to read directory: {}", e)
    })?;

    for entry in read_dir {
        let entry = entry.map_err(|e| {
            log::error!("Failed to read entry: {}", e);
            format!("Failed to read entry: {}", e)
        })?;
        let metadata = entry.metadata().map_err(|e| {
            log::error!("Failed to read metadata: {}", e);
            format!("Failed to read metadata: {}", e)
        })?;

        let name = entry.file_name().to_string_lossy().to_string();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| {
                let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                let secs = duration.as_secs() as i64;
                chrono::DateTime::from_timestamp(secs, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
            })
            .unwrap_or_default();

        let uid = platform::uid(&metadata);
        let gid = platform::gid(&metadata);

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            file_type: if metadata.is_dir() {
                "directory".to_string()
            } else if metadata.is_symlink() {
                "link".to_string()
            } else {
                "file".to_string()
            },
            size: metadata.len() as i64,
            mode: platform::format_mode(&metadata),
            perm: platform::perm(&metadata.permissions()) as i64,
            modified,
            uid: uid as i64,
            gid: gid as i64,
            user: platform::resolve_user(uid),
            group: platform::resolve_group(gid),
        });
    }

    entries.sort_by(|a, b| {
        if a.file_type != b.file_type {
            if a.file_type == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}
