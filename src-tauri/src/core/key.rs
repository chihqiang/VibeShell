use std::path::PathBuf;
use uuid::Uuid;

use openssl::pkey::PKey;

use super::models::KeyEntry;

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

/// 纯内存验证密钥 passphrase（不写任何临时文件）。
/// - OpenSSH 格式（BEGIN OPENSSH PRIVATE KEY）：openssl 无法解析，跳过导入期
///   校验，改由连接时 libssh2 内存认证校验 passphrase。
/// - 其他 PEM 格式：用 openssl 在内存中解密验证。
fn validate_passphrase(content: &str, passphrase: &str) -> Result<(), String> {
    if content.contains("BEGIN OPENSSH PRIVATE KEY") {
        return Ok(());
    }
    match PKey::private_key_from_pem_passphrase(content.as_bytes(), passphrase.as_bytes()) {
        Ok(_) => Ok(()),
        Err(e) => {
            let msg = e.to_string().to_lowercase();
            if msg.contains("bad decrypt") || msg.contains("bad password") {
                Err("Incorrect passphrase for encrypted private key".to_string())
            } else {
                Err(format!("Invalid or unsupported private key format: {}", e))
            }
        }
    }
}

fn create_entry(name: String, password: Option<String>, content: &str) -> Result<KeyEntry, String> {
    // 传统加密 PEM 必须提供 passphrase
    if is_traditional_encrypted_pem(content) {
        let pass = password.as_deref().unwrap_or("");
        if pass.is_empty() {
            return Err(
                "Key is encrypted (traditional PEM format), passphrase is required".to_string(),
            );
        }
        validate_passphrase(content, pass)?;
    } else if let Some(ref pass) = password {
        // 其他格式：有 passphrase 就验证
        if !pass.is_empty() {
            validate_passphrase(content, pass)?;
        }
    }

    let key_type = detect_key_type(content);
    // 仅生成条目并返回，由前端负责持久化到 plugin-store。
    Ok(KeyEntry {
        id: Uuid::new_v4().to_string(),
        name,
        key_type,
        password,
        content: content.to_string(),
    })
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
