use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use base64::Engine as _;

use super::models::KeyEntry;
use super::store;

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

fn is_pem_encrypted(content: &str) -> bool {
    content.contains("Proc-Type: 4,ENCRYPTED") || content.contains("DEK-Info:")
}

fn decode_pem_to_der(content: &str, encrypted: bool) -> Option<Vec<u8>> {
    let mut in_body = false;
    let mut body = String::new();
    for line in content.lines() {
        if line.contains("BEGIN ") && line.contains("PRIVATE KEY") {
            in_body = true;
            continue;
        }
        if in_body {
            if line.contains("END ") && line.contains("PRIVATE KEY") {
                break;
            }
            // Skip PEM headers
            if line.starts_with("Proc-Type:") || line.starts_with("DEK-Info:") {
                continue;
            }
            body.push_str(line.trim());
        }
    }
    if body.is_empty() {
        return None;
    }
    let b64 = base64::engine::general_purpose::STANDARD;
    let raw = b64.decode(body.as_bytes()).ok()?;
    if encrypted {
        // For encrypted PEM, hash the raw ciphertext as a stable identifier.
        // Actual passphrase validation happens during SSH connection.
        use sha2::{Digest, Sha256};
        let hash = Sha256::digest(&raw);
        Some(hash.to_vec())
    } else {
        Some(raw)
    }
}

fn compute_fingerprint(content: &str, passphrase: Option<&str>) -> Result<String, String> {
    use ssh_key::PrivateKey;

    let is_encrypted_pem = is_pem_encrypted(content);

    if is_encrypted_pem {
        let pass = passphrase.ok_or_else(|| {
            "Key is encrypted, please provide a passphrase".to_string()
        })?;
        if pass.is_empty() {
            return Err("Passphrase cannot be empty".to_string());
        }

        // Decode and hash the ciphertext to produce a stable fingerprint
        let hash = decode_pem_to_der(content, true).ok_or_else(|| {
            "Failed to decode encrypted PEM key".to_string()
        })?;
        let b64 = base64::engine::general_purpose::STANDARD;
        let fp = format!("SHA256:{}", b64.encode(&hash));
        return Ok(fp);
    }

    let key = if content.contains("BEGIN OPENSSH PRIVATE KEY") {
        PrivateKey::from_openssh(content)
    } else if content.contains("BEGIN ") && content.contains("PRIVATE KEY") {
        let der = decode_pem_to_der(content, false).ok_or_else(|| {
            "Failed to decode PEM key body".to_string()
        })?;
        PrivateKey::from_bytes(&der)
    } else {
        return Err("Unsupported key format".to_string());
    }
    .map_err(|e| format!("Failed to parse key: {}", e))?;

    let key = if key.is_encrypted() {
        let pass = passphrase.ok_or_else(|| {
            "Key is encrypted, please provide a passphrase".to_string()
        })?;
        key.decrypt(pass).map_err(|_| "Incorrect passphrase".to_string())?
    } else {
        key
    };

    let fp = key.fingerprint(ssh_key::HashAlg::Sha256);
    Ok(fp.to_string())
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
    let fingerprint = match compute_fingerprint(&content, password.as_deref()) {
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
