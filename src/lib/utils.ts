import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AuthMethod } from './types';

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

export function parseUptime(raw: string): { days: number; hours: number; minutes: number } | null {
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

export function parsePercent(raw: string): number {
  if (!raw) return 0;
  const m = raw.match(/\(([\d.]+)%\)/);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

export function formatMem(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/([\d.]+)(MB|GB)\s*\/\s*([\d.]+)(MB|GB)/);
  if (m) return `${m[1]}${m[2]} / ${m[3]}${m[4]}`;
  return raw;
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

export function buildSshConfig(params: {
  authMethod: AuthMethod;
  hostname: string;
  port: number;
  username: string;
  password?: string | null;
  keyPassphrase?: string | null;
  privateKeyPath?: string | null;
}) {
  const { authMethod, hostname, port, username, password, keyPassphrase, privateKeyPath } = params;
  return {
    hostname,
    port: port || 22,
    username,
    password: authMethod === 'password' ? (password ?? null) : (keyPassphrase ?? null),
    private_key_path: authMethod === 'key' ? (privateKeyPath ?? null) : null,
  };
}

// -- autocorrect guard --

function disableAutocorrect(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.spellcheck = false;
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocomplete', 'off');
  }
}

/**
 * Globally disable macOS autocorrect / autocapitalize on all input/textarea
 * elements. Call once at app startup.
 */
export function guardAutocorrect() {
  document.querySelectorAll('input, textarea').forEach(disableAutocorrect);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
            disableAutocorrect(node);
          }
          node.querySelectorAll('input, textarea').forEach(disableAutocorrect);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
