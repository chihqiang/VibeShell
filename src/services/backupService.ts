import { invoke } from '@/utils/invoke';

/** 备份数据 */
export function backupData(params: { destination: string }): Promise<void> {
  return invoke('backup_data', params);
}

/** 恢复数据 */
export function restoreData(params: { source: string }): Promise<void> {
  return invoke('restore_data', params);
}
