import { invoke } from '@/lib/api';

export function backupData(params: { destination: string }): Promise<void> {
  return invoke('backup_data', params);
}

export function restoreData(params: { source: string }): Promise<void> {
  return invoke('restore_data', params);
}
