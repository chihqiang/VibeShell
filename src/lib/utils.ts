import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AuthMethod } from './types';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import type { ConnectConfig } from '@/contexts/TerminalTabsContext';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -- file size --

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size < 1024 * 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(size / 1024 / 1024 / 1024 / 1024).toFixed(1)} TB`;
}

// -- uptime / percent / memory parsing --

function parseUptime(raw: string): { days: number; hours: number; minutes: number } | null {
  if (!raw) return null;
  const re = /up\s+(.*)/;
  const m = raw.match(re);
  const input = m ? m[1] : raw;
  let days = 0,
    hours = 0,
    minutes = 0;
  const dayRe = /(\d+)\s*days?/;
  const hourRe = /(\d+)\s*hours?/;
  const minRe = /(\d+)\s*minutes?/;
  const dayMatch = input.match(dayRe);
  const hourMatch = input.match(hourRe);
  const minMatch = input.match(minRe);
  if (dayMatch) days = parseInt(dayMatch[1], 10);
  if (hourMatch) hours = parseInt(hourMatch[1], 10);
  if (minMatch) minutes = parseInt(minMatch[1], 10);
  if (days === 0 && hours === 0 && minutes === 0) return null;
  return { days, hours, minutes };
}

export function formatUptime(raw: string, labels: { day: string; hour: string; minute: string }): string {
  const parsed = parseUptime(raw);
  if (!parsed) return raw || '';
  const { days, hours, minutes } = parsed;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${labels.day}`);
  if (hours > 0) parts.push(`${hours}${labels.hour}`);
  if (minutes > 0) parts.push(`${minutes}${labels.minute}`);
  return parts.join(' ');
}

export function parsePercent(raw: string): number {
  if (!raw) return 0;
  const m = raw.match(/\(([\d.]+)%\)/);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

// -- unix permissions --

export interface PermFlags {
  ur: boolean;
  uw: boolean;
  ux: boolean;
  gr: boolean;
  gw: boolean;
  gx: boolean;
  or: boolean;
  ow: boolean;
  ox: boolean;
}

export type FlagKey = keyof PermFlags;

export function permToFlags(perm: string): PermFlags {
  const num = parseInt(perm, 8);
  if (isNaN(num))
    return {
      ur: false,
      uw: false,
      ux: false,
      gr: false,
      gw: false,
      gx: false,
      or: false,
      ow: false,
      ox: false,
    };
  return {
    ur: !!(num & 0o400),
    uw: !!(num & 0o200),
    ux: !!(num & 0o100),
    gr: !!(num & 0o040),
    gw: !!(num & 0o020),
    gx: !!(num & 0o010),
    or: !!(num & 0o004),
    ow: !!(num & 0o002),
    ox: !!(num & 0o001),
  };
}

export function flagsToPerm(flags: PermFlags): string {
  const num =
    (flags.ur ? 0o400 : 0) |
    (flags.uw ? 0o200 : 0) |
    (flags.ux ? 0o100 : 0) |
    (flags.gr ? 0o040 : 0) |
    (flags.gw ? 0o020 : 0) |
    (flags.gx ? 0o010 : 0) |
    (flags.or ? 0o004 : 0) |
    (flags.ow ? 0o002 : 0) |
    (flags.ox ? 0o001 : 0);
  return num.toString(8).padStart(3, '0');
}

// -- async helpers --

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

// -- ssh config --

/**
 * Resolve private key path for a host.
 * If the host uses key auth but has no explicit path, fall back to the first imported key.
 */
export async function resolvePrivateKeyPath(host: HostConfig, keys: KeyEntry[]): Promise<string | null> {
  let privateKeyPath = host.private_key_path || null;
  if (host.auth_method === 'key' && !privateKeyPath && keys.length > 0) {
    const { getKeysPath } = await import('@/storage/config');
    const keysPath = await getKeysPath();
    privateKeyPath = `${keysPath}/${keys[0].file_name}`;
  }
  return privateKeyPath;
}

/**
 * Convert a HostConfig (API type) into a ConnectConfig (runtime SSH params).
 * Replaces the former buildSshConfig + resolvePrivateKeyPath + manual field mapping.
 */
export async function hostToConnectConfig(host: HostConfig, keys: KeyEntry[]): Promise<ConnectConfig> {
  const privateKeyPath = await resolvePrivateKeyPath(host, keys);
  return {
    hostname: host.hostname,
    port: host.port || 22,
    username: host.username,
    password: host.auth_method === 'password' ? (host.password ?? null) : null,
    privateKeyPath: host.auth_method === 'key' ? privateKeyPath : null,
  };
}

/**
 * Convert a HostFormState (form data) into a ConnectConfig (runtime SSH params).
 * Used by quick-connect flows that don't have a saved HostConfig yet.
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
    port: port || 22,
    username,
    password: authMethod === 'password' ? (password ?? null) : (keyPassphrase ?? null),
    privateKeyPath: authMethod === 'key' ? (privateKeyPath ?? null) : null,
  };
}

// -- SSH command parser for quick connect --

export interface ParsedSshCommand {
  username: string;
  hostname: string;
  port: number;
  password: string | null;
  privateKeyPath: string | null;
}

/**
 * Parse a single input line into SSH connection parameters.
 *
 * Supported formats:
 *   1. ssh [-p port] [-i keypath] user@host
 *   2. sshpass -p password ssh [-p port] [-i keypath] user@host
 *   3. user:password@host:port          (inline password)
 *   4. user@host:port                    (simple)
 *   5. user@host:port -i keypath         (with key file)
 *   6. host                              (just host, uses defaults)
 *
 * Returns null if no host can be found.
 */
export function parseSshCommand(raw: string): ParsedSshCommand | null {
  const input = raw.trim();
  if (!input) return null;

  let password: string | null = null;
  let privateKeyPath: string | null = null;
  let port = 22;
  let username = '';
  let hostname = '';

  // Tokenise by whitespace for command-style parsing
  const tokens = input.split(/\s+/);

  // Check for sshpass prefix: sshpass -p PASSWORD ssh ...
  let startIdx = 0;
  if (tokens[0] === 'sshpass') {
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i] === '-p' && i + 1 < tokens.length) {
        password = tokens[i + 1];
        i++; // skip value
      } else if (tokens[i] === 'ssh') {
        startIdx = i + 1;
        break;
      }
    }
    if (startIdx === 0) return null; // no ssh after sshpass
  } else if (tokens[0] === 'ssh') {
    startIdx = 1;
  }

  // If command-style (ssh or sshpass prefix detected)
  if (startIdx > 0) {
    // Parse flags and positional args
    const positional: string[] = [];
    for (let i = startIdx; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '-p' && i + 1 < tokens.length) {
        const p = parseInt(tokens[i + 1], 10);
        if (!isNaN(p) && p > 0 && p < 65536) port = p;
        i++; // skip value
      } else if (tok === '-i' && i + 1 < tokens.length) {
        privateKeyPath = tokens[i + 1];
        i++; // skip value
      } else if (tok.startsWith('-')) {
        // ignore unknown flags
      } else {
        positional.push(tok);
      }
    }

    // Find user@host in positional args
    const target = positional.find((t) => t.includes('@'));
    if (target) {
      const atIdx = target.indexOf('@');
      username = target.slice(0, atIdx);
      hostname = target.slice(atIdx + 1);
    } else if (positional.length > 0) {
      hostname = positional[0];
    }
  } else {
    // Non-command format: user:password@host:port  OR  user@host:port  OR  host
    let s = input;

    // Extract trailing -i keypath if present
    const keyMatch = s.match(/\s+-i\s+(\S+)\s*$/);
    if (keyMatch) {
      privateKeyPath = keyMatch[1];
      s = s.slice(0, keyMatch.index).trim();
    }

    const atIdx = s.indexOf('@');
    if (atIdx > 0) {
      const userPart = s.slice(0, atIdx);
      // Check for inline password: user:password
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

    // Extract port from hostname (IPv6 [::1]:port or host:port)
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

  // Expand ~ to home directory for key paths
  if (privateKeyPath && privateKeyPath.startsWith('~/')) {
    privateKeyPath = privateKeyPath.replace(/^~/, '');
    // The Rust side will resolve relative to home
  }

  return { username, hostname, port, password, privateKeyPath };
}

/**
 * Build a complete SSH command string from a ConnectConfig.
 * The output is designed to be parseable by `parseSshCommand` so that
 * copying host info and pasting into the Quick Connect bar works seamlessly.
 *
 * - With password:  user:password@host:port
 * - With key:       ssh -i keypath [-p port] user@host
 * - Plain:          ssh [-p port] user@host
 */
export function buildSshCommand(cfg: ConnectConfig): string {
  const { username, hostname, port, password, privateKeyPath } = cfg;

  // Inline password format — most compact
  if (password) {
    return `${username || 'root'}:${password}@${hostname}:${port}`;
  }

  // SSH command format with key
  const parts: string[] = ['ssh'];
  if (privateKeyPath) {
    parts.push('-i', privateKeyPath);
  }
  if (port && port !== 22) {
    parts.push('-p', String(port));
  }
  parts.push(`${username}@${hostname}`);
  return parts.join(' ');
}
