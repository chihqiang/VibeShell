use std::collections::{HashMap, HashSet};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::models::FileEntry;

/// Ensure the parent directory of `remote_path` exists on the remote.
/// Creates intermediate directories as needed, ignoring errors if they already exist.
pub fn ensure_remote_dir(sftp: &ssh2::Sftp, remote_path: &str) -> Result<(), String> {
    let parent = Path::new(remote_path).parent();
    let Some(parent) = parent else { return Ok(()) };
    let mut dir = PathBuf::new();
    for component in parent.components() {
        dir.push(component);
        let _ = sftp.mkdir(&dir, 0o755);
    }
    Ok(())
}

/// 读取远端文件大小（用于进度与断点续传）。
pub fn stat_remote(sftp: &ssh2::Sftp, remote_path: &str) -> Result<u64, String> {
    sftp.stat(Path::new(remote_path))
        .map_err(|e| format!("Failed to stat remote file '{}': {}", remote_path, e))?
        .size
        .ok_or_else(|| format!("Remote file '{}' has no size", remote_path))
}

/// 向远端文件指定偏移写入一块数据（本地文件由前端 plugin-fs 读取）。
/// - `!resume && offset == 0`：截断重建（新上传）。
/// - 否则：CREATE|WRITE 打开并从 offset 续写（断点续传）。
pub fn write_chunk(
    sftp: &ssh2::Sftp,
    remote_path: &str,
    offset: u64,
    data: &[u8],
    resume: bool,
) -> Result<u64, String> {
    ensure_remote_dir(sftp, remote_path)?;
    let flags = if !resume && offset == 0 {
        ssh2::OpenFlags::TRUNCATE | ssh2::OpenFlags::WRITE
    } else {
        ssh2::OpenFlags::CREATE | ssh2::OpenFlags::WRITE
    };
    let mut f = sftp
        .open_mode(Path::new(remote_path), flags, 0o644, ssh2::OpenType::File)
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_path, e))?;
    if offset > 0 {
        f.seek(SeekFrom::Start(offset)).map_err(|e| {
            format!(
                "Failed to seek remote file '{}' to {}: {}",
                remote_path, offset, e
            )
        })?;
    }
    f.write_all(data)
        .map_err(|e| format!("Failed to write remote file '{}': {}", remote_path, e))?;
    Ok(data.len() as u64)
}

/// 从远端文件指定偏移读取一块数据（本地文件由前端 plugin-fs 写入）。
pub fn read_chunk(
    sftp: &ssh2::Sftp,
    remote_path: &str,
    offset: u64,
    length: usize,
) -> Result<Vec<u8>, String> {
    let mut f = sftp
        .open(Path::new(remote_path))
        .map_err(|e| format!("Failed to open remote file '{}': {}", remote_path, e))?;
    if offset > 0 {
        f.seek(SeekFrom::Start(offset)).map_err(|e| {
            format!(
                "Failed to seek remote file '{}' to {}: {}",
                remote_path, offset, e
            )
        })?;
    }
    let mut buf = vec![0u8; length];
    let mut read_total = 0;
    while read_total < length {
        let n = f
            .read(&mut buf[read_total..])
            .map_err(|e| format!("Failed to read remote file '{}': {}", remote_path, e))?;
        if n == 0 {
            break;
        }
        read_total += n;
    }
    buf.truncate(read_total);
    Ok(buf)
}

#[allow(clippy::too_many_arguments)]
fn make_file_info(
    path: &Path,
    name: &str,
    size: i64,
    is_dir: bool,
    mode: i32,
    mtime: i64,
    uid: i64,
    gid: i64,
    user: &str,
    group: &str,
) -> FileEntry {
    let modified = chrono::DateTime::from_timestamp(mtime, 0)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default();

    FileEntry {
        name: name.to_string(),
        path: path.to_string_lossy().to_string(),
        file_type: if is_dir {
            "directory".to_string()
        } else {
            "file".to_string()
        },
        size,
        mode: super::format_mode(mode as u32),
        perm: mode as i64,
        modified,
        uid,
        gid,
        user: user.to_string(),
        group: group.to_string(),
    }
}

fn resolve_home(username: &str) -> String {
    if username == "root" {
        "/root".to_string()
    } else {
        format!("/home/{}", username)
    }
}

// ── Session-based SFTP operations ──

pub fn list_files_with_session(
    session: &ssh2::Session,
    sftp: &ssh2::Sftp,
    username: &str,
    path: &str,
    uid_cache: &Mutex<HashMap<i64, String>>,
    gid_cache: &Mutex<HashMap<i64, String>>,
) -> Result<super::models::SftpListResult, String> {
    let resolved = if path.is_empty() || path == "/" {
        "/".to_string()
    } else if path == "." {
        resolve_home(username)
    } else {
        path.to_string()
    };

    let dir = sftp.readdir(Path::new(&resolved)).map_err(|e| {
        log::error!("Failed to read directory: {}", e);
        format!("Failed to read directory: {}", e)
    })?;

    let (uid_map, gid_map) = resolve_users_groups_cached(session, &dir, uid_cache, gid_cache);

    let mut files: Vec<super::models::FileEntry> = dir
        .iter()
        .map(|(p, stat)| {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let uid = stat.uid.unwrap_or(0) as i64;
            let gid = stat.gid.unwrap_or(0) as i64;
            let user = uid_map
                .get(&uid)
                .cloned()
                .unwrap_or_else(|| uid.to_string());
            let group = gid_map
                .get(&gid)
                .cloned()
                .unwrap_or_else(|| gid.to_string());
            make_file_info(
                p,
                &name,
                stat.size.unwrap_or(0) as i64,
                stat.is_dir(),
                stat.perm.unwrap_or(0o644) as i32,
                stat.mtime.unwrap_or(0) as i64,
                uid,
                gid,
                &user,
                &group,
            )
        })
        .collect();

    files.sort_by(|a, b| {
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

    Ok(super::models::SftpListResult {
        path: resolved,
        files,
    })
}

/// Recursively list all file paths under a remote directory.
/// Returns a flat list of absolute remote file paths.
pub fn list_files_recursive_with_session(
    sftp: &ssh2::Sftp,
    path: &str,
) -> Result<Vec<String>, String> {
    let mut result = Vec::new();
    let mut stack = vec![path.to_string()];

    while let Some(current) = stack.pop() {
        let dir = sftp.readdir(Path::new(&current)).map_err(|e| {
            log::error!("Failed to read directory '{}': {}", current, e);
            format!("Failed to read directory '{}': {}", current, e)
        })?;

        for (p, stat) in &dir {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if name.starts_with('.') {
                continue;
            }
            if stat.is_dir() {
                stack.push(p.to_string_lossy().to_string());
            } else if stat.is_file() {
                result.push(p.to_string_lossy().to_string());
            }
        }
    }
    Ok(result)
}

/// Resolve UID→username / GID→tagName with per-session caching.
///
/// On the first call the cache is empty, so we query `/etc/passwd` and
/// `/etc/group` once and store every entry.  Subsequent calls only hit the
/// remote when a previously unseen UID/GID appears (rare), and even then
/// the full dump is a single SSH channel call.
fn load_passwd_group_data(
    session: &ssh2::Session,
    uid_cache: &Mutex<HashMap<i64, String>>,
    gid_cache: &Mutex<HashMap<i64, String>>,
) {
    let Ok(mut ch) = session.channel_session() else {
        return;
    };
    let cmd = "getent passwd 2>/dev/null || cat /etc/passwd 2>/dev/null; echo '---GRP---'; getent group 2>/dev/null || cat /etc/group 2>/dev/null";
    if ch.exec(cmd).is_err() {
        return;
    }
    let mut raw = String::new();
    if ch.read_to_string(&mut raw).is_err() {
        return;
    }

    // Accumulate into local maps first (lock-free parsing)
    let mut local_uid: HashMap<i64, String> = HashMap::new();
    let mut local_gid: HashMap<i64, String> = HashMap::new();
    let mut passwd = true;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed == "---GRP---" {
            passwd = false;
            continue;
        }
        let parts: Vec<&str> = trimmed.split(':').collect();
        if parts.len() >= 3 {
            if passwd {
                if let Ok(uid) = parts[2].parse::<i64>() {
                    local_uid.entry(uid).or_insert_with(|| parts[0].to_string());
                }
            } else if let Ok(gid) = parts[2].parse::<i64>() {
                local_gid.entry(gid).or_insert_with(|| parts[0].to_string());
            }
        }
    }

    // Merge into caches under lock (fast)
    if let Ok(mut uc) = uid_cache.lock() {
        uc.extend(local_uid);
    }
    if let Ok(mut gc) = gid_cache.lock() {
        gc.extend(local_gid);
    }
}

fn resolve_users_groups_cached(
    session: &ssh2::Session,
    dir: &[(std::path::PathBuf, ssh2::FileStat)],
    uid_cache: &Mutex<HashMap<i64, String>>,
    gid_cache: &Mutex<HashMap<i64, String>>,
) -> (HashMap<i64, String>, HashMap<i64, String>) {
    let needed_uids: HashSet<i64> = dir.iter().map(|(_, s)| s.uid.unwrap_or(0) as i64).collect();
    let needed_gids: HashSet<i64> = dir.iter().map(|(_, s)| s.gid.unwrap_or(0) as i64).collect();

    // Single lock: check cache and return if fully cached
    {
        let uc = uid_cache.lock().unwrap_or_else(|e| e.into_inner());
        let gc = gid_cache.lock().unwrap_or_else(|e| e.into_inner());
        if needed_uids.iter().all(|u| uc.contains_key(u))
            && needed_gids.iter().all(|g| gc.contains_key(g))
        {
            let uid_map: HashMap<i64, String> = needed_uids
                .iter()
                .map(|uid| {
                    (
                        *uid,
                        uc.get(uid).cloned().unwrap_or_else(|| uid.to_string()),
                    )
                })
                .collect();
            let gid_map: HashMap<i64, String> = needed_gids
                .iter()
                .map(|gid| {
                    (
                        *gid,
                        gc.get(gid).cloned().unwrap_or_else(|| gid.to_string()),
                    )
                })
                .collect();
            return (uid_map, gid_map);
        }
    }

    // Cache miss: load remote data
    load_passwd_group_data(session, uid_cache, gid_cache);

    // Re-read under a single lock
    let uc = uid_cache.lock().unwrap_or_else(|e| e.into_inner());
    let gc = gid_cache.lock().unwrap_or_else(|e| e.into_inner());
    let uid_map: HashMap<i64, String> = needed_uids
        .iter()
        .map(|uid| {
            (
                *uid,
                uc.get(uid).cloned().unwrap_or_else(|| uid.to_string()),
            )
        })
        .collect();
    let gid_map: HashMap<i64, String> = needed_gids
        .iter()
        .map(|gid| {
            (
                *gid,
                gc.get(gid).cloned().unwrap_or_else(|| gid.to_string()),
            )
        })
        .collect();
    (uid_map, gid_map)
}

pub fn delete_file_with_session(
    sftp: &ssh2::Sftp,
    path: &str,
    is_directory: bool,
) -> Result<(), String> {
    if is_directory {
        sftp.rmdir(Path::new(path)).map_err(|e| {
            log::error!("Failed to remove directory: {}", e);
            format!("Failed to remove directory: {}", e)
        })?;
    } else {
        sftp.unlink(Path::new(path)).map_err(|e| {
            log::error!("Failed to delete file: {}", e);
            format!("Failed to delete file: {}", e)
        })?;
    }
    Ok(())
}

pub fn rename_with_session(
    sftp: &ssh2::Sftp,
    old_path: &str,
    new_path: &str,
) -> Result<(), String> {
    sftp.rename(Path::new(old_path), Path::new(new_path), None)
        .map_err(|e| {
            log::error!("Failed to rename: {}", e);
            format!("Failed to rename: {}", e)
        })?;
    Ok(())
}

pub fn create_dir_with_session(sftp: &ssh2::Sftp, path: &str) -> Result<(), String> {
    sftp.mkdir(Path::new(path), 0o755).map_err(|e| {
        log::error!("Failed to create directory: {}", e);
        format!("Failed to create directory: {}", e)
    })?;
    Ok(())
}

pub fn read_file_with_session(sftp: &ssh2::Sftp, path: &str) -> Result<Vec<u8>, String> {
    let mut f = sftp.open(Path::new(path)).map_err(|e| {
        log::error!("Failed to open file: {}", e);
        format!("Failed to open file: {}", e)
    })?;
    let mut content = Vec::new();
    f.read_to_end(&mut content).map_err(|e| {
        log::error!("Failed to read file: {}", e);
        format!("Failed to read file: {}", e)
    })?;
    Ok(content)
}

pub fn write_file_with_session(sftp: &ssh2::Sftp, path: &str, content: &str) -> Result<(), String> {
    let mut f = sftp.create(Path::new(path)).map_err(|e| {
        log::error!("Failed to create file: {}", e);
        format!("Failed to create file: {}", e)
    })?;
    f.write_all(content.as_bytes()).map_err(|e| {
        log::error!("Failed to write file: {}", e);
        format!("Failed to write file: {}", e)
    })?;
    Ok(())
}

pub fn create_file_with_session(sftp: &ssh2::Sftp, path: &str) -> Result<(), String> {
    let mut f = sftp.create(Path::new(path)).map_err(|e| {
        log::error!("Failed to create file: {}", e);
        format!("Failed to create file: {}", e)
    })?;
    let _ = f.write_all(b"");
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn chmod_with_session(
    session: &ssh2::Session,
    sftp: &ssh2::Sftp,
    path: &str,
    mode: &str,
    user: Option<&str>,
    group: Option<&str>,
    recursive: bool,
    is_directory: bool,
) -> Result<(), String> {
    let mode_val = i32::from_str_radix(mode, 8).map_err(|e| {
        log::error!("Invalid mode: {}", e);
        format!("Invalid mode: {}", e)
    })?;
    let target = Path::new(path);

    let uid = resolve_uid(session, user);
    let gid = resolve_gid(session, group);

    // is_directory is provided by the caller from the file-listing metadata,
    // avoiding a redundant `sftp.stat()` round-trip.
    if recursive && is_directory {
        chmod_recursive(sftp, target, mode_val, uid, gid)?;
    } else {
        set_file_attrs(sftp, target, mode_val, uid, gid)?;
    }
    Ok(())
}

pub fn get_users_groups_with_session(
    session: &ssh2::Session,
    uid_cache: &Mutex<HashMap<i64, String>>,
    gid_cache: &Mutex<HashMap<i64, String>>,
) -> Result<super::models::UsersGroups, String> {
    {
        let uc = uid_cache.lock().unwrap_or_else(|e| e.into_inner());
        let gc = gid_cache.lock().unwrap_or_else(|e| e.into_inner());
        if !uc.is_empty() && !gc.is_empty() {
            let mut users: Vec<String> = uc.values().cloned().collect();
            users.sort();
            let mut groups: Vec<String> = gc.values().cloned().collect();
            groups.sort();
            return Ok(super::models::UsersGroups { users, groups });
        }
    }

    load_passwd_group_data(session, uid_cache, gid_cache);

    let uc = uid_cache.lock().unwrap_or_else(|e| e.into_inner());
    let gc = gid_cache.lock().unwrap_or_else(|e| e.into_inner());
    let mut users: Vec<String> = uc.values().cloned().collect();
    users.sort();
    let mut groups: Vec<String> = gc.values().cloned().collect();
    groups.sort();
    Ok(super::models::UsersGroups { users, groups })
}

// ── Helpers ──

/// Shell-safe single-quote: wrap `s` so it cannot break out of single quotes.
/// POSIX sh: `'xyz'\''abc'` → literal `xyz'abc`
fn sh_quote(s: &str) -> String {
    let escaped: String = s
        .chars()
        .flat_map(|c| {
            if c == '\'' {
                "'\\''".chars().collect::<Vec<_>>()
            } else {
                vec![c]
            }
        })
        .collect();
    format!("'{}'", escaped)
}

fn resolve_uid(session: &ssh2::Session, user: Option<&str>) -> Option<u32> {
    let u = user?;
    if u.is_empty() {
        return None;
    }
    if let Ok(n) = u.parse::<u32>() {
        return Some(n);
    }
    if let Ok(mut ch) = session.channel_session() {
        let cmd = format!("id -u {}", sh_quote(u));
        if ch.exec(&cmd).is_ok() {
            let mut out = String::new();
            if ch.read_to_string(&mut out).is_ok() {
                return out.trim().parse::<u32>().ok();
            }
        }
    }
    None
}

fn resolve_gid(session: &ssh2::Session, group: Option<&str>) -> Option<u32> {
    let g = group?;
    if g.is_empty() {
        return None;
    }
    if let Ok(n) = g.parse::<u32>() {
        return Some(n);
    }
    if let Ok(mut ch) = session.channel_session() {
        let cmd = format!("id -g {}", sh_quote(g));
        if ch.exec(&cmd).is_ok() {
            let mut out = String::new();
            if ch.read_to_string(&mut out).is_ok() {
                return out.trim().parse::<u32>().ok();
            }
        }
    }
    None
}

fn set_file_attrs(
    sftp: &ssh2::Sftp,
    path: &Path,
    mode: i32,
    uid: Option<u32>,
    gid: Option<u32>,
) -> Result<(), String> {
    sftp.setstat(
        path,
        ssh2::FileStat {
            size: None,
            uid,
            gid,
            perm: Some(mode as u32),
            atime: None,
            mtime: None,
        },
    )
    .map_err(|e| {
        log::error!("Failed to set file attrs: {}", e);
        format!("Failed to set file attrs: {}", e)
    })?;
    Ok(())
}

fn chmod_recursive(
    sftp: &ssh2::Sftp,
    dir: &Path,
    mode: i32,
    uid: Option<u32>,
    gid: Option<u32>,
) -> Result<(), String> {
    use std::collections::HashSet;
    const MAX_DEPTH: usize = 50;
    let mut visited: HashSet<PathBuf> = HashSet::new();
    let mut stack: Vec<(PathBuf, usize)> = vec![(dir.to_path_buf(), 0)];

    while let Some((current, depth)) = stack.pop() {
        // Canonicalize path to detect symlink cycles across different path text.
        let canon = sftp.realpath(&current).unwrap_or_else(|_| current.clone());
        if !visited.insert(canon) {
            continue;
        }
        if depth >= MAX_DEPTH {
            log::warn!(
                "[chmod] max depth ({}) reached at {}",
                MAX_DEPTH,
                current.display()
            );
            continue;
        }

        set_file_attrs(sftp, &current, mode, uid, gid)?;

        let entries = match sftp.readdir(&current) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for (entry_path, entry_stat) in entries {
            if entry_stat.is_dir() {
                stack.push((entry_path, depth + 1));
            } else {
                set_file_attrs(sftp, &entry_path, mode, uid, gid)?;
            }
        }
    }
    Ok(())
}
