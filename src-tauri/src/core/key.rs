use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

use base64::Engine as _;
use sha2::{Digest, Sha256};

use super::models::KeyEntry;
use super::store;

/// Maximum key file size we're willing to parse in-memory (1 MB).
const MAX_KEY_SIZE: usize = 1024 * 1024;

fn keys_dir() -> PathBuf {
    super::keys_path()
}

fn read_key_type(content: &str) -> String {
    if content.contains("BEGIN RSA PRIVATE KEY") {
        return "RSA".to_string();
    }
    if content.contains("BEGIN EC PRIVATE KEY") {
        return "ECDSA".to_string();
    }
    if content.contains("BEGIN OPENSSH PRIVATE KEY") {
        return "OPENSSH".to_string();
    }
    if content.contains("BEGIN DSA PRIVATE KEY") {
        return "DSA".to_string();
    }
    if content.contains("BEGIN SSH2 ENCRYPTED PRIVATE KEY") {
        return "ENCRYPTED".to_string();
    }
    "UNKNOWN".to_string()
}

fn is_encrypted(content: &str) -> bool {
    content.contains("Proc-Type: 4,ENCRYPTED") || content.contains("DEK-Info:")
}

/// Check whether `ssh-keygen` is available on this system.
fn ssh_keygen_available() -> bool {
    Command::new("ssh-keygen")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Try to compute the SHA256 fingerprint of an SSH key using only pure Rust.
///
/// Currently supports **OpenSSH** format keys (`-----BEGIN OPENSSH PRIVATE
/// KEY-----`).  The public key is stored in cleartext in this format so we do
/// **not** need to decrypt the key first.
fn compute_fingerprint_native(content: &str) -> Option<String> {
    if !content.contains("BEGIN OPENSSH PRIVATE KEY") {
        return None;
    }

    // Extract the base64 body between the header and footer lines
    let body: String = content
        .lines()
        .skip(1)
        .take_while(|l| !l.contains("END"))
        .collect();

    let b64 = base64::engine::general_purpose::STANDARD;
    let raw = b64.decode(body.as_bytes()).ok()?;

    // ── openssh-key-v1 wire format ──
    // "openssh-key-v1\0"
    //   ciphername   (uint32 len + bytes)
    //   kdfname      (uint32 len + bytes)
    //   kdfoptions   (uint32 len + bytes)
    //   nkeys        (uint32)
    //   pubkey[0]    (uint32 len + bytes)   ← the public key blob we hash
    //   pubkey[1]    …
    //   …

    let magic = b"openssh-key-v1\0";
    if !raw.starts_with(magic) {
        return None;
    }
    let mut pos = magic.len();

    let read_string = |p: &mut usize| -> Option<&[u8]> {
        if *p + 4 > raw.len() {
            return None;
        }
        let len = u32::from_be_bytes([
            raw[*p],
            raw[*p + 1],
            raw[*p + 2],
            raw[*p + 3],
        ]) as usize;
        *p += 4;
        if *p + len > raw.len() {
            return None;
        }
        let s = &raw[*p..*p + len];
        *p += len;
        Some(s)
    };

    // Skip ciphername, kdfname, kdfoptions
    read_string(&mut pos)?;
    read_string(&mut pos)?;
    read_string(&mut pos)?;

    // Number of keys
    if pos + 4 > raw.len() {
        return None;
    }
    let _nkeys = u32::from_be_bytes([
        raw[pos],
        raw[pos + 1],
        raw[pos + 2],
        raw[pos + 3],
    ]);
    pos += 4;

    // Read the first public key blob
    let pubkey_blob = read_string(&mut pos)?;

    // SHA256 that blob → base64
    let hash = Sha256::digest(pubkey_blob);
    let fp_b64 = b64.encode(hash);
    Some(format!("SHA256:{}", fp_b64))
}

fn validate_and_get_fingerprint(
    path: &Path,
    encrypted: bool,
    passphrase: Option<&str>,
) -> Result<String, String> {
    let has_cli = ssh_keygen_available();

    // ── Encrypted key → must use ssh-keygen to decrypt first ──
    if encrypted {
        let pass = passphrase.ok_or_else(|| {
            log::error!("Key is encrypted, please provide a passphrase");
            "Key is encrypted, please provide a passphrase".to_string()
        })?;

        if !has_cli {
            return Err(
                "ssh-keygen not found — cannot decrypt encrypted SSH keys. \
                 Please install openssh-client and try again."
                    .to_string(),
            );
        }

        let tmp = tempfile::NamedTempFile::new().map_err(|e| {
            log::error!("Failed to create temp file: {}", e);
            format!("Failed to create temp file: {}", e)
        })?;

        fs::copy(path, tmp.path()).map_err(|e| {
            log::error!("Failed to copy key to temp: {}", e);
            format!("Failed to copy key to temp: {}", e)
        })?;

        let tmp_path = tmp.path().to_string_lossy().to_string();

        let mut decrypt_child = Command::new("ssh-keygen")
            .args(["-p", "-N", "", "-f", &tmp_path])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run ssh-keygen: {}", e))?;

        if let Some(mut stdin) = decrypt_child.stdin.take() {
            stdin.write_all(pass.as_bytes()).map_err(|e| {
                log::error!("Failed to write passphrase to ssh-keygen stdin: {}", e);
                format!("Failed to write passphrase: {}", e)
            })?;
            drop(stdin);
        }

        let decrypt = decrypt_child.wait_with_output().map_err(|e| {
            log::error!("Failed to wait for ssh-keygen: {}", e);
            format!("Failed to run ssh-keygen: {}", e)
        })?;

        if !decrypt.status.success() {
            let stderr = String::from_utf8_lossy(&decrypt.stderr);
            let err_msg = if stderr.contains("incorrect")
                || stderr.contains("bad passphrase")
                || stderr.contains("decode")
            {
                "Incorrect passphrase".to_string()
            } else {
                format!("Invalid key: {}", stderr.trim())
            };
            return Err(err_msg);
        }

        // Now get the fingerprint of the decrypted temp key
        let output = Command::new("ssh-keygen")
            .args(["-lf", &tmp_path])
            .stdin(std::process::Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run ssh-keygen: {}", e))?;

        return parse_fingerprint_output(output);
    }

    // ── Unencrypted key ──
    // Try native parser first (no subprocess, works everywhere)
    let too_large = fs::metadata(path)
        .map(|m| m.len() > MAX_KEY_SIZE as u64)
        .unwrap_or(false);
    if !too_large {
        if let Ok(content) = fs::read_to_string(path) {
            if let Some(fp) = compute_fingerprint_native(&content) {
                return Ok(fp);
            }
        }
    } else {
        log::warn!("key file too large ({} bytes), skipping native parser", path.display());
    }

    // Fallback to ssh-keygen for key formats we can't parse natively
    if !has_cli {
        return Err(
            "ssh-keygen not found — cannot compute fingerprint for this key format. \
             Only OpenSSH format keys are supported without ssh-keygen."
                .to_string(),
        );
    }

    let output = Command::new("ssh-keygen")
        .args(["-lf", &path.to_string_lossy()])
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| {
            log::error!("Failed to run ssh-keygen: {}", e);
            format!("Failed to run ssh-keygen: {}", e)
        })?;

    parse_fingerprint_output(output)
}

fn parse_fingerprint_output(output: std::process::Output) -> Result<String, String> {
    if output.status.success() {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if s.is_empty() {
            Err("No fingerprint".to_string())
        } else {
            Ok(s)
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = stderr.trim().to_string();
        log::error!("Invalid key: {}", err_msg);
        Err(format!("Invalid key: {}", err_msg))
    }
}

fn expand_path(source_path: &str) -> PathBuf {
    if source_path.starts_with('~') {
        let home = super::home_dir();
        PathBuf::from(source_path.replacen('~', &home.to_string_lossy(), 1))
    } else {
        Path::new(source_path).to_path_buf()
    }
}

pub fn list_keys() -> Result<Vec<KeyEntry>, String> {
    store::list_keys()
}

fn ensure_unique_filename(base: &str) -> Result<String, String> {
    if !store::key_exists_by_file_name(base)? {
        return Ok(base.to_string());
    }
    let stem = Path::new(base)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| base.to_string());
    let ext = Path::new(base)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    Ok(format!(
        "{}_{}{}",
        stem,
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("1"),
        ext
    ))
}

fn finalize_key_import(
    dest_path: &Path,
    name: String,
    file_name: String,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    let content = fs::read_to_string(dest_path).map_err(|e| {
        log::error!("Failed to read key: {}", e);
        format!("Failed to read key: {}", e)
    })?;
    let encrypted = is_encrypted(&content);
    let fingerprint = match validate_and_get_fingerprint(dest_path, encrypted, password.as_deref()) {
        Ok(fp) => fp,
        Err(e) => {
            let _ = fs::remove_file(dest_path);
            return Err(e);
        }
    };
    let key_type = read_key_type(&content);
    let now = chrono::Utc::now().timestamp();
    let entry = KeyEntry {
        id: Uuid::new_v4().to_string(),
        name,
        file_name,
        key_type,
        fingerprint,
        imported_at: now,
        password,
    };
    store::insert_key(&entry)?;
    Ok(entry)
}

pub fn import_key(
    source_path: String,
    name: Option<String>,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    let expanded = expand_path(&source_path);
    if !expanded.exists() {
        log::error!("File not found: {}", expanded.display());
        return Err(format!("File not found: {}", expanded.display()));
    }

    let original_name = name.unwrap_or_else(|| {
        expanded
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    });

    let dest_name = ensure_unique_filename(&original_name)?;
    let dest_path = keys_dir().join(&dest_name);
    fs::create_dir_all(keys_dir()).map_err(|e| {
        log::error!("Failed to create keys dir: {}", e);
        format!("Failed to create keys dir: {}", e)
    })?;
    fs::copy(&expanded, &dest_path).map_err(|e| {
        log::error!("Failed to copy key: {}", e);
        format!("Failed to copy key: {}", e)
    })?;

    finalize_key_import(&dest_path, original_name, dest_name, password)
}

pub fn import_key_content(
    content: String,
    name: String,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    let file_name = ensure_unique_filename(&name)?;
    let dest_path = keys_dir().join(&file_name);
    fs::create_dir_all(keys_dir()).map_err(|e| {
        log::error!("Failed to create keys dir: {}", e);
        format!("Failed to create keys dir: {}", e)
    })?;
    fs::write(&dest_path, &content).map_err(|e| {
        log::error!("Failed to write key: {}", e);
        format!("Failed to write key: {}", e)
    })?;

    finalize_key_import(&dest_path, name, file_name, password)
}

pub fn delete_key(id: String) -> Result<(), String> {
    let entry = store::delete_key(id)?;

    let linked = store::hosts_using_key(&entry.file_name)?;
    if !linked.is_empty() {
        log::warn!(
            "Key in use by hosts: {}, please unlink first",
            linked.join(", ")
        );
        return Err(format!(
            "Key in use by hosts: {}, please unlink first",
            linked.join(", ")
        ));
    }

    let key_path = keys_dir().join(&entry.file_name);
    if key_path.exists() {
        fs::remove_file(&key_path).map_err(|e| {
            log::error!("Failed to delete file: {}", e);
            format!("Failed to delete file: {}", e)
        })?;
    }

    Ok(())
}
