import { invoke } from '@/utils/invoke';
import type { AppConfig, SshDefaultsData } from '@/types/config';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import {
  DEFAULT_SSH_PORT,
  DEFAULT_MONITOR_INTERVAL,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_MAX_RETRIES,
  DEFAULT_RECONNECT_INITIAL_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
} from '@/constants/app';
import { getStorage, setStorage } from '@/utils/storage';

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

// ── 模块级内存缓存 ──

/** 应用启动时通过 `initAppConfig()` 填充，后续所有读取走内存 */
let configCache: AppConfig | null = null;
let sshDefaultsCache: SshDefaultsData | null = null;

// ── API 调用 ──

/** 获取应用配置（直接走后端，绕过缓存） */
export function getAppConfig(): Promise<AppConfig> {
  return invoke('get_app_config');
}

/** 保存 SSH 默认配置（直接走后端） */
export function saveSshDefaultsRaw(params: { defaults: SshDefaultsData }): Promise<void> {
  return invoke('save_ssh_defaults', params);
}

/** 从后端拉取并填充缓存 */
async function fetchAndFillCache(): Promise<void> {
  try {
    const cfg = await getAppConfig();
    configCache = cfg;
    setStorage(STORAGE_KEYS.CONFIG_APP, cfg);
  } catch {
    // 后端调用失败时，尝试从 localStorage 恢复
    if (!configCache) {
      configCache = getStorage<AppConfig | null>(STORAGE_KEYS.CONFIG_APP, null);
    }
  }
}

// ── 初始化 ──

/** 初始化应用配置 —— 启动时调用一次 */
export async function initAppConfig(): Promise<void> {
  if (configCache) return;
  await fetchAndFillCache();
}

// ── 配置读取 ──

/** 获取数据路径 */
export function getDataPath(): string {
  return configCache?.data_path ?? '';
}

/** 获取密钥路径 */
export function getKeysPath(): string {
  return configCache?.keys_path ?? '';
}

/** 获取 SSH 默认配置 */
export async function getSshDefaults(): Promise<SshDefaultsData> {
  if (sshDefaultsCache) return sshDefaultsCache;
  if (configCache) {
    sshDefaultsCache = configCache.ssh_defaults;
    return sshDefaultsCache;
  }
  // 兜底：走一次后端
  await fetchAndFillCache();
  sshDefaultsCache = (configCache as AppConfig | null)?.ssh_defaults ?? SSH_FALLBACK;
  return sshDefaultsCache!;
}

/** 保存 SSH 默认配置 */
export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  try {
    await saveSshDefaultsRaw({ defaults: values });
  } catch {
    // 后端写入失败时静默处理
  }
  sshDefaultsCache = values;
  setStorage(STORAGE_KEYS.CONFIG_SSH_DEFAULTS, values);
}

// ── 缓存清理 ──

/** 清除缓存 */
export function clearConfigCache(): void {
  configCache = null;
  sshDefaultsCache = null;
  setStorage(STORAGE_KEYS.CONFIG_APP, null);
  setStorage(STORAGE_KEYS.CONFIG_SSH_DEFAULTS, null);
}
