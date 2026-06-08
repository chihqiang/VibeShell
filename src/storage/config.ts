import { getAppConfig, saveSshDefaults as saveSshDefaultsRaw } from '@/apis/api/config';
import type { AppConfig, SshDefaultsData } from '@/apis/types/config';
import { getStorage, setStorage } from '@/lib/storage';

export type { SshDefaultsData };

// ── Cache keys ──

const APP_KEY = 'config_app';
const SSH_KEY = 'config_ssh_defaults';

// ── Fallbacks ──

export const SSH_FALLBACK: SshDefaultsData = {
  hostname: '',
  username: '',
  port: 22,
  monitorInterval: 4,
  heartbeatInterval: 10,
  reconnectEnabled: true,
  reconnectMaxRetries: 10,
  reconnectInitialDelay: 1,
  reconnectMaxDelay: 30,
};

// ── Helpers ──

async function fetchAndCacheAppConfig(): Promise<AppConfig | null> {
  try {
    const cfg = await getAppConfig();
    setStorage(APP_KEY, cfg);
    return cfg;
  } catch {
    return null;
  }
}

function getCachedFullConfig(): AppConfig | null {
  return getStorage<AppConfig | null>(APP_KEY, null);
}

async function getFromConfig<T>(dedicatedKey: string | null, extract: (cfg: AppConfig) => T, fallback: T): Promise<T> {
  if (dedicatedKey) {
    const cached = getStorage<T | null>(dedicatedKey, null);
    if (cached) return cached;
  }

  const full = getCachedFullConfig();
  if (full) {
    const val = extract(full);
    if (dedicatedKey) setStorage(dedicatedKey, val);
    return val;
  }

  const fresh = await fetchAndCacheAppConfig();
  if (fresh) {
    const val = extract(fresh);
    if (dedicatedKey) setStorage(dedicatedKey, val);
    return val;
  }

  return fallback;
}

// ── Init + data path ──

export async function initAppConfig(): Promise<void> {
  if (getCachedFullConfig()) return;
  await fetchAndCacheAppConfig();
}

export async function getDataPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.data_path, '');
}

export async function getKeysPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.keys_path, '');
}

// ── SSH defaults ──

export async function getSshDefaults(): Promise<SshDefaultsData> {
  return getFromConfig(SSH_KEY, (cfg) => cfg.ssh_defaults, SSH_FALLBACK);
}

export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  try {
    await saveSshDefaultsRaw({ defaults: values });
  } catch {
    // silently fail
  }
  setStorage(SSH_KEY, values);
}

// ── Cache invalidation ──

export function clearConfigCache(): void {
  setStorage(APP_KEY, null);
  setStorage(SSH_KEY, null);
}
