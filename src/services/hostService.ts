import { invoke } from '@/utils/invoke';
import { listKeys } from './keyService';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';

// ── API 调用 ──

/** 获取所有主机列表 */
export function listHosts(): Promise<HostConfig[]> {
  return invoke('list_hosts');
}

/** 获取主机总数（比 listHosts 轻量得多） */
export function countHosts(): Promise<number> {
  return invoke('count_hosts');
}

/** 保存主机 */
export function saveHost(params: { host: HostConfig }): Promise<void> {
  return invoke('save_host', params);
}

/** 删除主机 */
export function deleteHost(params: { id: string }): Promise<void> {
  return invoke('delete_host', params);
}

/** 获取所有标签 */
export function listTags(): Promise<string[]> {
  return invoke('list_tags');
}

// ── 组合查询 ──

/** 一次性获取主机、标签和密钥数据 */
export async function fetchAllHostData(): Promise<{
  hosts: HostConfig[];
  tags: string[];
  keys: KeyEntry[];
}> {
  const [hosts, tags, keys] = await Promise.all([listHosts(), listTags(), listKeys()]);
  return { hosts, tags, keys };
}

/** 一次性获取主机和密钥数据 */
export async function fetchHostsAndKeys(): Promise<{
  hosts: HostConfig[];
  keys: KeyEntry[];
}> {
  const [hosts, keys] = await Promise.all([listHosts(), listKeys()]);
  return { hosts, keys };
}
