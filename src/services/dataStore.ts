import { LazyStore } from '@tauri-apps/plugin-store';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import type { SshDefaultsData, ProxyConfig } from '@/types/config';

/**
 * 前端数据持久化层 —— 基于 @tauri-apps/plugin-store（JSON 文件）。
 *
 * 所有业务数据（主机、密钥、SSH 默认配置）统一存放在这里，
 * 替代原 Rust 后端的 SQLite 存储。后端不再承担任何应用数据存储职责。
 *
 * 数据文件位于 Tauri 的 app_data_dir 下（如 macOS:
 * ~/Library/Application Support/com.chihqiang.vibeshell/vibeshell.json）。
 */
const store = new LazyStore('vibeshell.json');

/** Store 键名常量 */
const KEYS = {
  hosts: 'hosts',
  keys: 'keys',
  sshDefaults: 'ssh_defaults',
  proxy: 'proxy',
} as const;

// ── Hosts ──

/** 获取所有主机 */
export async function listHosts(): Promise<HostConfig[]> {
  return (await store.get<HostConfig[]>(KEYS.hosts)) ?? [];
}

/** 保存单个主机（新增时自动生成 id） */
export async function saveHost(host: HostConfig): Promise<HostConfig> {
  const hosts = await listHosts();
  const now = Date.now();
  const exists = host.id && hosts.some((h) => h.id === host.id);
  const saved: HostConfig = exists ? host : { ...host, id: host.id || crypto.randomUUID(), created_at: now };
  const next = exists
    ? hosts.map((h) => (h.id === saved.id ? { ...saved, updated_at: now } : h))
    : [...hosts, { ...saved, created_at: now, updated_at: now }];
  await store.set(KEYS.hosts, next);
  await store.save();
  return saved;
}

/** 删除主机 */
export async function deleteHost(id: string): Promise<void> {
  const hosts = await listHosts();
  await store.set(
    KEYS.hosts,
    hosts.filter((h) => h.id !== id),
  );
  await store.save();
}

/** 获取主机总数 */
export async function countHosts(): Promise<number> {
  return (await listHosts()).length;
}

/** 按 id 获取主机 */
export async function getHost(id: string): Promise<HostConfig | undefined> {
  return (await listHosts()).find((h) => h.id === id);
}

// ── Keys ──

/** 获取所有密钥 */
export async function listKeys(): Promise<KeyEntry[]> {
  return (await store.get<KeyEntry[]>(KEYS.keys)) ?? [];
}

/** 新增密钥 */
export async function addKey(key: KeyEntry): Promise<void> {
  const keys = await listKeys();
  await store.set(KEYS.keys, [...keys, key]);
  await store.save();
}

/** 删除密钥 */
export async function deleteKey(id: string): Promise<void> {
  const keys = await listKeys();
  await store.set(
    KEYS.keys,
    keys.filter((k) => k.id !== id),
  );
  await store.save();
}

/** 按 id 获取密钥 */
export async function getKey(id: string): Promise<KeyEntry | undefined> {
  return (await listKeys()).find((k) => k.id === id);
}

/** 查询引用指定密钥的主机名称列表 */
export async function getKeyReferrers(keyId: string): Promise<string[]> {
  const hosts = await listHosts();
  return hosts.filter((h) => h.key_id === keyId).map((h) => h.name);
}

// ── SSH Defaults ──

/** 获取 SSH 默认配置 */
export async function getSshDefaults(): Promise<SshDefaultsData | undefined> {
  return store.get<SshDefaultsData>(KEYS.sshDefaults);
}

/** 保存 SSH 默认配置 */
export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  await store.set(KEYS.sshDefaults, values);
  await store.save();
}

// ── Proxy ──

/** 获取代理配置 */
export async function getProxyConfig(): Promise<ProxyConfig | undefined> {
  return store.get<ProxyConfig>(KEYS.proxy);
}

/** 保存代理配置 */
export async function saveProxyConfig(values: ProxyConfig): Promise<void> {
  await store.set(KEYS.proxy, values);
  await store.save();
}

// ── 批量覆盖（备份/恢复用） ──

/** 全量覆盖所有数据（备份恢复用，原子写入） */
export async function replaceAllData(
  hosts: HostConfig[],
  keys: KeyEntry[],
  sshDefaults: SshDefaultsData | null,
): Promise<void> {
  await store.set(KEYS.hosts, hosts);
  await store.set(KEYS.keys, keys);
  if (sshDefaults) {
    await store.set(KEYS.sshDefaults, sshDefaults);
  } else {
    await store.delete(KEYS.sshDefaults);
  }
  await store.save();
}
