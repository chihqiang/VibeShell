use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex, RwLock};
use std::time::UNIX_EPOCH;

use tauri::Emitter;

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

// ── Transfer management ──

/// Cancel flag per transfer_id
static ACTIVE_TRANSFERS: LazyLock<RwLock<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

fn make_progress_callback(
    app_handle: &tauri::AppHandle,
    transfer_id: &str,
) -> Box<core::sftp::ProgressFn> {
    let tid = transfer_id.to_string();
    let ah = app_handle.clone();
    const MIN_INTERVAL_MILLIS: u64 = 80;
    let last_emit = Arc::new(AtomicU64::new(
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    ));
    Box::new(move |current, total, phase| {
        let now_ms = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let last = last_emit.load(Ordering::Relaxed);
        if now_ms - last < MIN_INTERVAL_MILLIS && current < total {
            return;
        }
        last_emit.store(now_ms, Ordering::Relaxed);
        let _ = ah.emit(
            "sftp://transfer-progress",
            serde_json::json!({
                "transferId": tid,
                "current": current,
                "total": total,
                "phase": phase,
            }),
        );
    })
}

/// Register a new transfer, returning the cancel flag
fn register_transfer(transfer_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = ACTIVE_TRANSFERS.write() {
        map.insert(transfer_id.to_string(), flag.clone());
    }
    flag
}

/// Unregister a transfer after completion
fn unregister_transfer(transfer_id: &str) {
    if let Ok(mut map) = ACTIVE_TRANSFERS.write() {
        map.remove(transfer_id);
    }
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
pub fn sftp_download_file(
    tab_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    log::info!("[sftp] tab={}: download {} -> {}", tab_id, remote_path, local_path);
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::download_file_with_session(sftp, &remote_path, &local_path)
    })
}

#[tauri::command]
pub fn sftp_upload_file(
    tab_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    log::info!("[sftp] tab={}: upload {} -> {}", tab_id, local_path, remote_path);
    with_session(&tab_id, |_, sftp, _| {
        core::sftp::upload_file_with_session(sftp, &local_path, &remote_path)
    })
}

#[tauri::command]
pub fn sftp_delete_file(
    tab_id: String,
    path: String,
    is_directory: bool,
) -> Result<(), String> {
    log::info!("[sftp] tab={}: delete {} (dir={})", tab_id, path, is_directory);
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
        tab_id, path, mode, user, group, recursive
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

// ── Progress-based transfers (used by TransferTable) ──

/// Shared transfer boilerplate: register, lock session, spawn_blocking, unregister.
async fn with_transfer<T>(
    app_handle: tauri::AppHandle,
    tab_id: String,
    transfer_id: String,
    chunk_size_kb: Option<usize>,
    action: &'static str,
    body: impl FnOnce(&ssh2::Sftp, Option<usize>, &Arc<AtomicBool>, &core::sftp::ProgressFn) -> Result<T, String> + Send + 'static,
) -> Result<T, String>
where
    T: Send + 'static + std::fmt::Debug,
{
    let cancel = register_transfer(&transfer_id);
    let on_progress = make_progress_callback(&app_handle, &transfer_id);

    tauri::async_runtime::spawn_blocking(move || {
        let handle = core::session::get(&tab_id)?;
        let inner = handle.lock().map_err(|e| {
            log::error!("Lock error: {}", e);
            format!("Lock error: {}", e)
        })?;
        let _guard = core::session::BlockingGuard::new(&inner.session);
        let chunk_size = chunk_size_kb.map(|kb| kb * 1024);
        let result = body(&inner.sftp, chunk_size, &cancel, &on_progress);
        unregister_transfer(&transfer_id);
        log::info!(
            "[sftp] tab={tab_id}: {action} done transfer_id={transfer_id} result={result:?}",
        );
        result
    })
    .await
    .map_err(|e| format!("{action} task cancelled: {e}"))?
}

#[tauri::command]
pub async fn sftp_upload_file_progress(
    app_handle: tauri::AppHandle,
    tab_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
    chunk_size_kb: Option<usize>,
) -> Result<u64, String> {
    log::info!(
        "[sftp] tab={}: upload-progress {} -> {} (transfer_id={})",
        tab_id, local_path, remote_path, transfer_id
    );
    with_transfer(
        app_handle, tab_id, transfer_id, chunk_size_kb, "upload-progress",
        move |sftp, chunk_size, cancel, on_progress| {
            core::sftp::upload_file(sftp, &local_path, &remote_path, false, Some(cancel), on_progress, chunk_size)
        },
    )
    .await
}

#[tauri::command]
pub async fn sftp_upload_file_resume(
    app_handle: tauri::AppHandle,
    tab_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
    chunk_size_kb: Option<usize>,
) -> Result<u64, String> {
    log::info!(
        "[sftp] tab={}: upload-resume {} -> {} (transfer_id={})",
        tab_id, local_path, remote_path, transfer_id
    );
    with_transfer(
        app_handle, tab_id, transfer_id, chunk_size_kb, "upload-resume",
        move |sftp, chunk_size, cancel, on_progress| {
            core::sftp::upload_file(sftp, &local_path, &remote_path, true, Some(cancel), on_progress, chunk_size)
        },
    )
    .await
}

#[tauri::command]
pub async fn sftp_download_file_progress(
    app_handle: tauri::AppHandle,
    tab_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
    chunk_size_kb: Option<usize>,
) -> Result<u64, String> {
    log::info!(
        "[sftp] tab={}: download-progress {} -> {} (transfer_id={})",
        tab_id, remote_path, local_path, transfer_id
    );
    with_transfer(
        app_handle, tab_id, transfer_id, chunk_size_kb, "download-progress",
        move |sftp, chunk_size, cancel, on_progress| {
            core::sftp::download_file_chunked(sftp, &remote_path, &local_path, Some(cancel), on_progress, chunk_size)
        },
    )
    .await
}

#[tauri::command]
pub fn sftp_cancel_transfer(transfer_id: String) -> Result<(), String> {
    if let Ok(map) = ACTIVE_TRANSFERS.read() {
        if let Some(flag) = map.get(&transfer_id) {
            flag.store(true, Ordering::Relaxed);
            return Ok(());
        }
    }
    {
        log::warn!("Transfer not found");
        Err("Transfer not found".to_string())
    }
}

#[tauri::command]
pub fn sftp_list_local_files(path: String) -> Result<Vec<(String, String, u64)>, String> {
    core::sftp::list_local_files_recursive(&path)
}

/// Check if a local path is a directory.
#[tauri::command]
pub fn sftp_is_directory(path: String) -> Result<bool, String> {
    // Try read_dir first — if it succeeds, it's a directory
    if let Ok(mut entries) = std::fs::read_dir(&path) {
        if let Some(Ok(entry)) = entries.next() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                return Ok(true);
            }
        }
        return Ok(true);
    }
    // Fallback to metadata
    match std::fs::metadata(&path) {
        Ok(m) => Ok(m.is_dir()),
        Err(_) => Ok(false),
    }
}
