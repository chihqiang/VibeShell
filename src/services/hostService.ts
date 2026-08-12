import { listKeys } from './keyService';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import {
  listHosts as storeListHosts,
  saveHost as storeSaveHost,
  deleteHost as storeDeleteHost,
  countHosts as storeCountHosts,
} from './dataStore';

// ── API 调用 ──

/** 获取所有主机列表 */
export function listHosts(): Promise<HostConfig[]> {
  return storeListHosts();
}

/** 获取主机总数（比 listHosts 轻量得多） */
export function countHosts(): Promise<number> {
  return storeCountHosts();
}

/** 保存主机 */
export async function saveHost(params: { host: HostConfig }): Promise<void> {
  await storeSaveHost(params.host);
}

/** 删除主机 */
export function deleteHost(params: { id: string }): Promise<void> {
  return storeDeleteHost(params.id);
}

// ── 组合查询 ──

/** 一次性获取主机和密钥数据 */
export async function fetchHostsAndKeys(): Promise<{
  hosts: HostConfig[];
  keys: KeyEntry[];
}> {
  const [hosts, keys] = await Promise.all([listHosts(), listKeys()]);
  return { hosts, keys };
}
