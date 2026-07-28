use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::Command;
use uuid::Uuid;

use super::models::KeyEntry;
use super::store;

fn detect_key_type(content: &str) -> String {
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
    "UNKNOWN".to_string()
}

/// 检测是否为传统加密 PEM（OpenSSL 格式）
fn is_traditional_encrypted_pem(content: &str) -> bool {
    content.contains("Proc-Type: 4,ENCRYPTED") || content.contains("DEK-Info:")
}

/// 通过 ssh-keygen 验证密钥 passphrase 是否正确
fn validate_passphrase(content: &str, passphrase: &str) -> Result<(), String> {
    let tmp_id = Uuid::new_v4().to_string();
    let tmp_dir = super::data_dir().join("tmp");
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| format!("create tmp dir: {}", e))?;
    let tmp_path = tmp_dir.join(format!("keycheck_{}", tmp_id));
    std::fs::write(&tmp_path, content)
        .map_err(|e| format!("write temp key for validation: {}", e))?;
    // ssh-keygen 要求私钥文件权限为 0600
    std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("set key file permissions: {}", e))?;

    let result = Command::new("ssh-keygen")
        .args(["-y", "-f"])
        .arg(&tmp_path)
        .args(["-P", passphrase])
        .output();

    std::fs::remove_file(&tmp_path).ok();

    match result {
        Ok(output) => {
            if output.status.success() {
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let err_msg = stderr.trim();
                if err_msg.contains("incorrect passphrase") || err_msg.contains("wrong passphrase") {
                    Err("Incorrect passphrase for encrypted private key".to_string())
                } else if err_msg.contains("no passphrase") {
                    Err("Key requires a passphrase".to_string())
                } else if err_msg.contains("not a private key") || err_msg.contains("invalid format") {
                    Err("Invalid or unsupported private key format".to_string())
                } else {
                    Err(format!("Key validation failed: {}", err_msg))
                }
            }
        }
        Err(e) => {
            log::warn!("[key] ssh-keygen not available, skipping passphrase validation: {}", e);
            Ok(())
        }
    }
}

fn create_entry(name: String, password: Option<String>, content: &str) -> Result<KeyEntry, String> {
    // 传统加密 PEM 必须提供 passphrase
    if is_traditional_encrypted_pem(content) {
        let pass = password.as_deref().unwrap_or("");
        if pass.is_empty() {
            return Err("Key is encrypted (traditional PEM format), passphrase is required".to_string());
        }
        validate_passphrase(content, pass)?;
    } else if let Some(ref pass) = password {
        // 其他格式：有 passphrase 就验证
        if !pass.is_empty() {
            validate_passphrase(content, pass)?;
        }
    }

    let key_type = detect_key_type(content);
    let entry = KeyEntry {
        id: Uuid::new_v4().to_string(),
        name,
        key_type,
        password,
        content: content.to_string(),
    };
    store::insert_key(&entry)?;
    Ok(entry)
}

pub fn list_keys() -> Result<Vec<KeyEntry>, String> {
    store::list_keys()
}

pub fn import_key(
    source_path: String,
    name: Option<String>,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    let expanded = if source_path.starts_with('~') {
        let home = super::home_dir();
        PathBuf::from(home).join(&source_path[2..])
    } else {
        PathBuf::from(&source_path)
    };

    let path = std::path::Path::new(&expanded);
    if !path.exists() {
        log::error!("File not found: {}", expanded.display());
        return Err(format!("File not found: {}", expanded.display()));
    }

    let original_name = name.unwrap_or_else(|| {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    });

    let content = std::fs::read_to_string(&expanded).map_err(|e| {
        log::error!("Failed to read key file: {}", e);
        format!("Failed to read key file: {}", e)
    })?;

    create_entry(original_name, password, &content)
}

pub fn import_key_content(
    content: String,
    name: String,
    password: Option<String>,
) -> Result<KeyEntry, String> {
    create_entry(name, password, &content)
}

pub fn delete_key(id: String) -> Result<(), String> {
    let _entry = store::delete_key(&id)?;
    Ok(())
}
