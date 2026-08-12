import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import type { SshDefaultsData } from '@/types/config';
import { listHosts, listKeys, getSshDefaults, replaceAllData } from './dataStore';

/** 备份文件格式 */
interface BackupPayload {
  version: number;
  exportedAt: number;
  hosts: HostConfig[];
  keys: KeyEntry[];
  sshDefaults: SshDefaultsData | null;
}

/** 备份数据到指定 JSON 文件（纯前端，读 store + 写文件） */
export async function backupData(params: { destination: string }): Promise<void> {
  const [hosts, keys, sshDefaults] = await Promise.all([listHosts(), listKeys(), getSshDefaults()]);
  const payload: BackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    hosts,
    keys,
    sshDefaults: sshDefaults ?? null,
  };
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(params.destination, JSON.stringify(payload, null, 2));
}

/** 从指定 JSON 文件恢复数据（纯前端，读文件 + 覆盖 store） */
export async function restoreData(params: { source: string }): Promise<void> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const json = await readTextFile(params.source);
  const payload = JSON.parse(json) as BackupPayload;
  if (!Array.isArray(payload.hosts) || !Array.isArray(payload.keys)) {
    throw new Error('Invalid backup file format');
  }
  await replaceAllData(payload.hosts, payload.keys, payload.sshDefaults ?? null);
}
