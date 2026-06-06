import { invoke } from '@/lib/api';
import type { AppConfig, SshDefaultsData, HotkeyConfig } from '@/apis/types/config';

export function getAppConfig(): Promise<AppConfig> {
  return invoke('get_app_config');
}

export function saveSshDefaults(params: { defaults: SshDefaultsData }): Promise<void> {
  return invoke('save_ssh_defaults', params);
}

export function loadHotkeys(): Promise<HotkeyConfig> {
  return invoke('load_hotkeys');
}

export function saveHotkeys(params: { config: HotkeyConfig }): Promise<void> {
  return invoke('save_hotkeys', params);
}
