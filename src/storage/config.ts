import { getAppConfig, saveSshDefaults as saveSshDefaultsRaw } from '@/apis/api/config';
import type {
  AppConfig,
  SshDefaultsData,
  HotkeyAction,
  HotkeyActionDef,
  KeyBinding,
  HotkeyConfig,
} from '@/apis/types/config';
import { getStorage, setStorage } from '@/lib/storage';

export type { HotkeyAction, HotkeyActionDef, HotkeyConfig, SshDefaultsData, KeyBinding };

// ── Cache keys ──

const APP_KEY = 'config_app';
const SSH_KEY = 'config_ssh_defaults';
const HOTKEY_KEY = 'config_hotkey_defaults';

// ── Fallbacks ──

export const SSH_FALLBACK: SshDefaultsData = {
  hostname: '',
  username: '',
  port: 22,
  monitorInterval: 4,
  heartbeatInterval: 10,
  reconnectEnabled: true,
  reconnectMaxRetries: 10,
  reconnectInitialDelay: 1,
  reconnectMaxDelay: 30,
};

const HOTKEY_FALLBACK: Record<string, KeyBinding> = {};

// ── Helpers ──

async function fetchAndCacheAppConfig(): Promise<AppConfig | null> {
  try {
    const cfg = await getAppConfig();
    setStorage(APP_KEY, cfg);
    return cfg;
  } catch {
    return null;
  }
}

function getCachedFullConfig(): AppConfig | null {
  return getStorage<AppConfig | null>(APP_KEY, null);
}

async function getFromConfig<T>(dedicatedKey: string | null, extract: (cfg: AppConfig) => T, fallback: T): Promise<T> {
  if (dedicatedKey) {
    const cached = getStorage<T | null>(dedicatedKey, null);
    if (cached) return cached;
  }

  const full = getCachedFullConfig();
  if (full) {
    const val = extract(full);
    if (dedicatedKey) setStorage(dedicatedKey, val);
    return val;
  }

  const fresh = await fetchAndCacheAppConfig();
  if (fresh) {
    const val = extract(fresh);
    if (dedicatedKey) setStorage(dedicatedKey, val);
    return val;
  }

  return fallback;
}

// ── Init + data path ──

export async function initAppConfig(): Promise<void> {
  if (getCachedFullConfig()) return;
  await fetchAndCacheAppConfig();
}

export async function getDataPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.data_path, '');
}

export async function getKeysPath(): Promise<string> {
  return getFromConfig(null, (cfg) => cfg.keys_path, '');
}

// ── SSH defaults ──

export async function getSshDefaults(): Promise<SshDefaultsData> {
  return getFromConfig(SSH_KEY, (cfg) => cfg.ssh_defaults, SSH_FALLBACK);
}

export async function saveSshDefaults(values: SshDefaultsData): Promise<void> {
  try {
    await saveSshDefaultsRaw({ defaults: values });
  } catch {
    // silently fail
  }
  setStorage(SSH_KEY, values);
}

// ── Hotkey defaults ──

export async function getHotkeyDefaults(): Promise<Record<string, KeyBinding>> {
  return getFromConfig(HOTKEY_KEY, (cfg) => cfg.hotkey_defaults, HOTKEY_FALLBACK);
}

// ── Cache invalidation ──

export function clearHotkeyCache(): void {
  setStorage(HOTKEY_KEY, null);
}

export function clearConfigCache(): void {
  setStorage(APP_KEY, null);
  setStorage(SSH_KEY, null);
  setStorage(HOTKEY_KEY, null);
}

// ── Hotkey action metadata ──

const HOTKEY_ACTION_META: { id: HotkeyAction; labelKey: string }[] = [
  { id: 'duplicateTab', labelKey: 'settings.hotkeys.duplicateTab' },
  { id: 'reconnectTab', labelKey: 'settings.hotkeys.reconnectTab' },
];

export async function getHotkeyActions(): Promise<HotkeyActionDef[]> {
  const defaults = await getHotkeyDefaults();
  return HOTKEY_ACTION_META.map((m) => ({
    ...m,
    defaultBinding: defaults[m.id] ?? {
      key: '',
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    },
  }));
}

// ── Hotkey formatting ──

export function formatKeyBinding(b: KeyBinding): string {
  const parts: string[] = [];
  if (b.meta) parts.push('⌘');
  if (b.ctrl) parts.push('Ctrl');
  if (b.alt) parts.push('Alt');
  if (b.shift) parts.push('Shift');
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join('+');
}

export function keyBindingFromEvent(e: KeyboardEvent): KeyBinding | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  return {
    key: e.key,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
  };
}

export function keyBindingsMatch(a: KeyBinding, b: KeyBinding): boolean {
  return a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.meta === b.meta;
}
