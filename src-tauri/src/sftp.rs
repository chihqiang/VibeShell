use std::collections::HashMap;
use std::sync::Mutex;

use crate::core;

// ── Session helpers ──

/// Lock TabSession, call a closure with (&Session, &Sftp, &str), return its result.
/// Avoids the caller having to lock/unlock explicitly.
fn with_session<T>(
    tab_id: &str,
    f: impl FnOnce(&ssh2::Session, &ssh2::Sftp, &str) -> Result<T, String>,
) -> Result<T, String> {
    let handle = core::session::get(tab_id)?;
    let inner = handle.lock().map_err(|e| e.to_string())?;
    let _guard = core::session::BlockingGuard::new(&inner.session);
    f(&inner.session, &inner.sftp, &inner.username)
}

/// Like `with_session` but also passes the UID/GID caches.
fn with_session_cached<T>(
    tab_id: &str,
    f: impl FnOnce(
        &ssh2::Session,
        &ssh2::Sftp,
        &str,
        &Mutex<HashMap<i64, String>>,
        &Mutex<HashMap<i64, String>>,
    ) -> Result<T, String>,
) -> Result<T, String> {
    let handle = core::session::get(tab_id)?;
    let inner = handle.lock().map_err(|e| e.to_string())?;
    let _guard = core::session::BlockingGuard::new(&inner.session);
    f(
        &inner.session,
        &inner.sftp,
        &inner.username,
        &inner.uid_cache,
        &inner.gid_cache,
    )
}

// ── TabId-based commands ──

#[tauri::command]
pub fn sftp_list_files(
    tab_id: String,
    path: String,
) -> Result<core::models::SftpListResult, String> {
    log::info!("[sftp] tab={}: list path={}", tab_id, path);
    with_session_cached(&tab_id, |session, sftp, username, uid_cache, gid_cache| {
        core::sftp::list_files_with_session(session, sftp, username, &path, uid_cache, gid_cache)
    })
}

#[tauri::command]
pub fn sftp_list_files_recursive(tab_id: String, path: String) -> Result<Vec<String>, String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::list_files_recursive_with_session(sftp, &path)
    })
}

#[tauri::command]
pub fn sftp_delete_file(tab_id: String, path: String, is_directory: bool) -> Result<(), String> {
    log::info!(
        "[sftp] tab={}: delete {} (dir={})",
        tab_id,
        path,
        is_directory
    );
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::delete_file_with_session(sftp, &path, is_directory)
    })
}

#[tauri::command]
pub fn sftp_rename(tab_id: String, old_path: String, new_path: String) -> Result<(), String> {
    log::info!("[sftp] tab={}: rename {} -> {}", tab_id, old_path, new_path);
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::rename_with_session(sftp, &old_path, &new_path)
    })
}

#[tauri::command]
pub fn sftp_create_dir(tab_id: String, path: String) -> Result<(), String> {
    log::info!("[sftp] tab={}: mkdir {}", tab_id, path);
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::create_dir_with_session(sftp, &path)
    })
}

#[tauri::command]
pub fn sftp_read_file(tab_id: String, path: String) -> Result<Vec<u8>, String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::read_file_with_session(sftp, &path)
    })
}

#[tauri::command]
pub fn sftp_write_file(tab_id: String, path: String, content: String) -> Result<(), String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::write_file_with_session(sftp, &path, &content)
    })
}

#[tauri::command]
pub fn sftp_create_file(tab_id: String, path: String) -> Result<(), String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::create_file_with_session(sftp, &path)
    })
}

#[tauri::command]
pub fn sftp_chmod(
    tab_id: String,
    path: String,
    mode: String,
    user: Option<String>,
    group: Option<String>,
    recursive: bool,
    is_directory: bool,
) -> Result<(), String> {
    log::info!(
        "[sftp] tab={}: chmod {} mode={} user={:?} group={:?} recursive={}",
        tab_id,
        path,
        mode,
        user,
        group,
        recursive
    );
    with_session(&tab_id, |session, sftp, _| {
        core::sftp::chmod_with_session(
            session,
            sftp,
            &path,
            &mode,
            user.as_deref(),
            group.as_deref(),
            recursive,
            is_directory,
        )
    })
}

#[tauri::command]
pub fn sftp_get_users_groups(tab_id: String) -> Result<core::models::UsersGroups, String> {
    with_session_cached(&tab_id, |session, _, _, uid_cache, gid_cache| {
        core::sftp::get_users_groups_with_session(session, uid_cache, gid_cache)
    })
}

// ── Chunked transfer primitives（本地文件由前端 plugin-fs 读写，Rust 只操作远端） ──

#[tauri::command]
pub fn sftp_stat_remote(tab_id: String, path: String) -> Result<u64, String> {
    with_session(&tab_id, |_, sftp, _| core::sftp::stat_remote(sftp, &path))
}

#[tauri::command]
pub fn sftp_write_chunk(
    tab_id: String,
    remote_path: String,
    offset: u64,
    data: Vec<u8>,
    resume: bool,
) -> Result<u64, String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::write_chunk(sftp, &remote_path, offset, &data, resume)
    })
}

#[tauri::command]
pub fn sftp_read_chunk(
    tab_id: String,
    remote_path: String,
    offset: u64,
    length: usize,
) -> Result<Vec<u8>, String> {
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::read_chunk(sftp, &remote_path, offset, length)
    })
}
