import { invoke } from '@/utils/invoke';
import type { AppConfig, SshDefaultsData } from '@/types/config';
import { getStorage, setStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import {
  DEFAULT_SSH_PORT,
  DEFAULT_MONITOR_INTERVAL,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_MAX_RETRIES,
  DEFAULT_RECONNECT_INITIAL_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
} from '@/constants/app';

export type { SshDefaultsData };

/** SSH 默认配置回退值 */
export const SSH_FALLBACK: SshDefaultsData = {
  hostname: '',
  username: '',
  port: DEFAULT_SSH_PORT,
  monitorInterval: DEFAULT_MONITOR_INTERVAL,
  heartbeatInterval: DEFAULT_HEARTBEAT_INTERVAL,
  reconnectEnabled: true,
  reconnectMaxRetries: DEFAULT_RECONNECT_MAX_RETRIES,
  reconnectInitialDelay: DEFAULT_RECONNECT_INITIAL_DELAY,
  reconnectMaxDelay: DEFAULT_RECONNECT_MAX_DELAY,
};

// ── API 调用 ──

/** 获取应用配置 */
export function getAppConfig(): Promise<AppConfig> {
  return invoke('get_app_config');
}

/** 保存 SSH 默认配置 */
export function saveSshDefaultsRaw(params: { defaults: SshDefaultsData }): Promise<void> {
  return invoke('save_ssh_defaults', params);
}

// ── 缓存层 ──

/** 拉取并缓存应用配置 */
async function fetchAndCacheAppConfig(): Promise<AppConfig | null> {
  try {
    const cfg = await getAppConfig();
    setStorage(STORAGE_KEYS.CONFIG_APP, cfg);
    return cfg;
  } catch {
    return null;
  }
}

/** 获取缓存的应用配置 */
function getCachedFullConfig(): AppConfig | null {
  return getStorage<AppConfig | null>(STORAGE_KEYS.CONFIG_APP, null);
}

/** 从配置中提取值（带缓存） */
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

// ── 初始化 + 路径 ──

/** 初始化应用配置 */
export async function initAppConfig(): Promise<void> {
  if (getCachedFullConfig()) return;
  await fetchAndCacheAppConfig();
}

/** 获取数据路径 */
export async function getDataPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.data_path, '');
}

/** 获取密钥路径 */
export async function getKeysPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.keys_path, '');
}

// ── SSH 默认配置 ──

/** 获取 SSH 默认配置 */
export async function getSshDefaults(): Promise<SshDefaultsData> {
  return getFromConfig(STORAGE_KEYS.CONFIG_SSH_DEFAULTS, (cfg) => cfg.ssh_defaults, SSH_FALLBACK);
}

/** 保存 SSH 默认配置 */
export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  try {
    await saveSshDefaultsRaw({ defaults: values });
  } catch {
    // silently fail
  }
  setStorage(STORAGE_KEYS.CONFIG_SSH_DEFAULTS, values);
}

// ── 缓存清理 ──

/** 清除配置缓存 */
export function clearConfigCache(): void {
  setStorage(STORAGE_KEYS.CONFIG_APP, null);
  setStorage(STORAGE_KEYS.CONFIG_SSH_DEFAULTS, null);
}
