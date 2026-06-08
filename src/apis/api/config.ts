import { invoke } from '@/lib/api';
import type { AppConfig, SshDefaultsData } from '@/apis/types/config';

export function getAppConfig(): Promise<AppConfig> {
  return invoke('get_app_config');
}

export function saveSshDefaults(params: { defaults: SshDefaultsData }): Promise<void> {
  return invoke('save_ssh_defaults', params);
}
