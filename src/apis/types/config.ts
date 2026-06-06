export interface AppConfig {
  data_path: string;
  keys_path: string;
  ssh_defaults: SshDefaultsData;
  hotkey_defaults: Record<string, KeyBinding>;
}

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
