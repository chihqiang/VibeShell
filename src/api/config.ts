import { invoke } from '@tauri-apps/api/core';

// ── App Config ──

export interface AppConfig {
  data_path: string;
  keys_path: string;
  ssh_defaults: SshDefaultsData;
  hotkey_defaults: Record<string, KeyBinding>;
}

export function getAppConfig(): Promise<AppConfig> {
  return invoke('get_app_config');
}

// ── SSH Defaults Types ──

export interface SshDefaultsData {
  hostname: string;
  username: string;
  port: number;
  monitorInterval: number;
  heartbeatInterval: number;
  reconnectEnabled: boolean;
  reconnectMaxRetries: number;
  reconnectInitialDelay: number;
  reconnectMaxDelay: number;
}

// ── Hotkeys Types ──

export interface KeyBinding {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type HotkeyConfig = Record<string, KeyBinding>;

export type HotkeyAction = 'duplicateTab' | 'reconnectTab';

export interface HotkeyActionDef {
  id: HotkeyAction;
  labelKey: string;
  defaultBinding: KeyBinding;
}

// ── SSH Defaults API ──

export function saveSshDefaults(params: { defaults: SshDefaultsData }): Promise<void> {
  return invoke('save_ssh_defaults', params);
}

// ── Hotkey API ──

export function loadHotkeys(): Promise<HotkeyConfig> {
  return invoke('load_hotkeys');
}

export function saveHotkeys(params: { config: HotkeyConfig }): Promise<void> {
  return invoke('save_hotkeys', params);
}
