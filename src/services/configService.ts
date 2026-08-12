import type { SshDefaultsData, ProxyConfig } from '@/types/config';
import {
  DEFAULT_SSH_PORT,
  DEFAULT_MONITOR_INTERVAL,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_MAX_RETRIES,
  DEFAULT_RECONNECT_INITIAL_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
  DEFAULT_IDLE_TIMEOUT,
} from '@/constants/app';
import { DOM_EVENTS } from '@/constants/events';
import {
  getSshDefaults as storeGetSshDefaults,
  saveSshDefaults as storeSaveSshDefaults,
  getProxyConfig as storeGetProxyConfig,
  saveProxyConfig as storeSaveProxyConfig,
} from './dataStore';

export type { SshDefaultsData, ProxyConfig };

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
  idleTimeout: DEFAULT_IDLE_TIMEOUT,
};

/** 代理配置回退值（默认关闭，固定 SOCKS5，默认指向本地代理 127.0.0.1:7897） */
export const PROXY_FALLBACK: ProxyConfig = {
  enabled: false,
  host: '127.0.0.1',
  port: 7897,
  username: '',
  password: '',
};

// ── 模块级内存缓存 ──

/** SSH 默认配置缓存，避免每次读取都命中磁盘 */
let sshDefaultsCache: SshDefaultsData | null = null;

// ── 初始化 ──

/** 初始化应用配置 —— 启动时调用一次（预加载 SSH 默认配置到缓存） */
export async function initAppConfig(): Promise<void> {
  if (sshDefaultsCache) return;
  try {
    const d = await storeGetSshDefaults();
    sshDefaultsCache = d ?? SSH_FALLBACK;
  } catch {
    // store 加载失败（如 IPC 未就绪 / 文件损坏）时静默回退默认值，
    // 避免启动阶段产生 unhandled promise rejection 触发 webview 异常。
    sshDefaultsCache = SSH_FALLBACK;
  }
}

// ── 配置读取 ──

/** 获取 SSH 默认配置 */
export async function getSshDefaults(): Promise<SshDefaultsData> {
  if (sshDefaultsCache) return sshDefaultsCache;
  const d = await storeGetSshDefaults();
  sshDefaultsCache = d ?? SSH_FALLBACK;
  return sshDefaultsCache;
}

/** 保存 SSH 默认配置 */
export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  try {
    await storeSaveSshDefaults(values);
  } catch {
    // 写入失败时静默处理，内存缓存仍生效
  }
  sshDefaultsCache = values;
}

// ── 代理配置 ──

/** 获取代理配置 */
export async function getProxyConfig(): Promise<ProxyConfig> {
  const p = await storeGetProxyConfig();
  return p ?? PROXY_FALLBACK;
}

/** 保存代理配置 */
export async function saveProxyConfig(values: ProxyConfig): Promise<void> {
  await storeSaveProxyConfig(values);
  // 通知状态栏等 UI 刷新代理状态
  window.dispatchEvent(new CustomEvent(DOM_EVENTS.PROXY_CHANGED));
}

// ── 缓存清理 ──

/** 清除缓存 */
export function clearConfigCache(): void {
  sshDefaultsCache = null;
}
