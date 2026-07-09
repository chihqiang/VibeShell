import type { AuthMethod } from '@/types/common';
import type { HostConfig, ConnectConfig, ParsedSshCommand } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import { DEFAULT_SSH_PORT } from '@/constants/app';

/**
 * 解析私有密钥路径。
 * 如果主机使用密钥认证但没有显式路径，则回退到第一个导入的密钥。
 */
export async function resolvePrivateKeyPath(host: HostConfig, keys: KeyEntry[]): Promise<string | null> {
  let privateKeyPath = host.private_key_path || null;
  if (host.auth_method === 'key' && !privateKeyPath && keys.length > 0) {
    const { getKeysPath } = await import('@/services/configService');
    const keysPath = await getKeysPath();
    privateKeyPath = `${keysPath}/${keys[0].file_name}`;
  }
  return privateKeyPath;
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
    password: host.auth_method === 'password' ? (host.password ?? null) : null,
    privateKeyPath: host.auth_method === 'key' ? privateKeyPath : null,
  };
}

/**
 * 将 HostFormState（表单数据）转换为 ConnectConfig（运行时 SSH 参数）。
 * 用于没有保存 HostConfig 的快速连接流程。
 */
export function formToConnectConfig(form: {
  authMethod: AuthMethod;
  hostname: string;
  port: number;
  username: string;
  password?: string | null;
  keyPassphrase?: string | null;
  privateKeyPath?: string | null;
}): ConnectConfig {
  const { authMethod, hostname, port, username, password, keyPassphrase, privateKeyPath } = form;
  return {
    hostname,
    port: port || DEFAULT_SSH_PORT,
    username,
    password: authMethod === 'password' ? (password ?? null) : (keyPassphrase ?? null),
    privateKeyPath: authMethod === 'key' ? (privateKeyPath ?? null) : null,
  };
}

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

  let password: string | null = null;
  let privateKeyPath: string | null = null;
  let port = DEFAULT_SSH_PORT;
  let username = '';
  let hostname = '';

  const tokens = input.split(/\s+/);

  let startIdx = 0;
  if (tokens[0] === 'sshpass') {
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i] === '-p' && i + 1 < tokens.length) {
        password = tokens[i + 1];
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
        // ignore unknown flags
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
        password = userPart.slice(colonIdx + 1);
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

  if (privateKeyPath && privateKeyPath.startsWith('~/')) {
    privateKeyPath = privateKeyPath.replace(/^~/, '');
  }

  return { username, hostname, port, password, privateKeyPath };
}

/**
 * 从 ConnectConfig 构建 SSH 命令字符串。
 * 输出可被 `parseSshCommand` 解析，以便复制主机信息并粘贴到快速连接栏。
 */
export function buildSshCommand(cfg: ConnectConfig): string {
  const { username, hostname, port, password, privateKeyPath } = cfg;

  if (password) {
    return `${username || 'root'}:${password}@${hostname}:${port}`;
  }

  const parts: string[] = ['ssh'];
  if (privateKeyPath) {
    parts.push('-i', privateKeyPath);
  }
  if (port && port !== DEFAULT_SSH_PORT) {
    parts.push('-p', String(port));
  }
  parts.push(`${username}@${hostname}`);
  return parts.join(' ');
}
