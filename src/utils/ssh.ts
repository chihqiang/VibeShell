import type { HostConfig, ConnectConfig, ParsedSshCommand } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import { DEFAULT_SSH_PORT } from '@/constants/app';

/**
 * 解析私有密钥路径。
 * 如果主机使用密钥认证，则返回 host.key_id（后端已存储的密钥 ID）；
 * 如果未设置 key_id 但有可用密钥，则回退到第一个密钥的 ID。
 */
export async function resolvePrivateKeyPath(host: HostConfig, keys: KeyEntry[]): Promise<string | null> {
  if (host.auth_method === 'key') {
    return host.key_id || (keys.length > 0 ? keys[0].id : null);
  }
  return null;
}

/**
 * 将 HostConfig（API 类型）转换为 ConnectConfig（运行时 SSH 参数）。
 */
export async function hostToConnectConfig(host: HostConfig, keys: KeyEntry[]): Promise<ConnectConfig> {
  const privateKeyPath = await resolvePrivateKeyPath(host, keys);
  return {
    hostname: host.hostname,
    port: host.port || DEFAULT_SSH_PORT,
    username: host.username,
    password: host.password ?? null,
    privateKeyPath,
  };
}

/**
 * 将 HostConfig 转换为 ConnectConfig（运行时 SSH 参数）。
 */
export function formToConnectConfig(host: HostConfig): ConnectConfig {
  return {
    hostname: host.hostname,
    port: host.port || DEFAULT_SSH_PORT,
    username: host.username,
    password: host.password ?? null,
    privateKeyPath: host.auth_method === 'key' ? (host.key_id ?? null) : null,
  };
}

// ── SSH 命令解析 ──

/**
 * 解析 SSH 命令字符串为连接参数。
 *
 * 支持的格式：
 *   1. ssh [-p port] [-i keypath] user@host
 *   2. sshpass -p password ssh [-p port] [-i keypath] user@host
 *   3. user:password@host:port          (inline password)
 *   4. user@host:port                    (simple)
 *   5. user@host:port -i keypath         (with key file)
 *   6. host                              (just host, uses defaults)
 *
 * 如果找不到主机则返回 null。
 */
export function parseSshCommand(raw: string): ParsedSshCommand | null {
  const input = raw.trim();
  if (!input) return null;

  let loginPassword: string | null = null;
  let privateKeyPath: string | null = null;
  let port = DEFAULT_SSH_PORT;
  let username = '';
  let hostname = '';

  const tokens = input.split(/\s+/);

  let startIdx = 0;
  if (tokens[0] === 'sshpass') {
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i] === '-p') {
        loginPassword = tokens[i + 1] || null;
        i++;
      } else if (tokens[i] === 'ssh') {
        startIdx = i + 1;
        break;
      }
    }
    if (startIdx === 0) return null;
  } else if (tokens[0] === 'ssh') {
    startIdx = 1;
  }

  if (startIdx > 0) {
    const positional: string[] = [];
    for (let i = startIdx; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '-p' && i + 1 < tokens.length) {
        const p = parseInt(tokens[i + 1], 10);
        if (!isNaN(p) && p > 0 && p < 65536) port = p;
        i++;
      } else if (tok === '-i' && i + 1 < tokens.length) {
        privateKeyPath = tokens[i + 1];
        i++;
      } else if (tok.startsWith('-')) {
      } else {
        positional.push(tok);
      }
    }

    const target = positional.find((t) => t.includes('@'));
    if (target) {
      const atIdx = target.indexOf('@');
      username = target.slice(0, atIdx);
      hostname = target.slice(atIdx + 1);
    } else if (positional.length > 0) {
      hostname = positional[0];
    }
  } else {
    let s = input;

    const keyMatch = s.match(/\s+-i\s+(\S+)\s*$/);
    if (keyMatch) {
      privateKeyPath = keyMatch[1];
      s = s.slice(0, keyMatch.index).trim();
    }

    const atIdx = s.indexOf('@');
    if (atIdx > 0) {
      const userPart = s.slice(0, atIdx);
      const colonIdx = userPart.indexOf(':');
      if (colonIdx > 0) {
        username = userPart.slice(0, colonIdx);
        loginPassword = userPart.slice(colonIdx + 1) || null;
      } else {
        username = userPart;
      }
      s = s.slice(atIdx + 1);
    }

    hostname = s;

    if (hostname.startsWith('[')) {
      const close = hostname.indexOf(']');
      if (close > 0) {
        const after = hostname.slice(close + 1);
        hostname = hostname.slice(1, close);
        if (after.startsWith(':')) {
          const p = parseInt(after.slice(1), 10);
          if (!isNaN(p) && p > 0 && p < 65536) port = p;
        }
      }
    } else {
      const colonIdx = hostname.lastIndexOf(':');
      if (colonIdx > 0) {
        const p = parseInt(hostname.slice(colonIdx + 1), 10);
        if (!isNaN(p) && p > 0 && p < 65536) {
          port = p;
          hostname = hostname.slice(0, colonIdx);
        }
      }
    }
  }

  if (!hostname) return null;

  return { username, hostname, port, password: loginPassword, privateKeyPath };
}

/**
 * 从 ConnectConfig 构建 SSH 命令字符串。
 */
export function buildSshCommand(cfg: ConnectConfig): string {
  const { username, hostname, port, privateKeyPath } = cfg;

  const parts: string[] = ['ssh'];
  if (privateKeyPath && !/^[0-9a-f-]{36}$/i.test(privateKeyPath)) {
    parts.push('-i', privateKeyPath);
  }
  if (port && port !== DEFAULT_SSH_PORT) {
    parts.push('-p', String(port));
  }
  parts.push(`${username}@${hostname}`);
  return parts.join(' ');
}
