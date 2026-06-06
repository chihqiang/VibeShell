import {
  getAppConfig,
  saveSshDefaults as saveSshDefaultsRaw,
  type AppConfig,
  type SshDefaultsData,
  type HotkeyAction,
  type HotkeyActionDef,
} from '@/api/config';
import type { KeyBinding, HotkeyConfig } from '@/api/config';
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

// ── Init + data path ──

export async function initAppConfig(): Promise<void> {
  if (getCachedFullConfig()) return;
  await fetchAndCacheAppConfig();
}

export async function getDataPath(): Promise<string> {
  const cached = getCachedFullConfig();
  if (cached) return cached.data_path;
  const cfg = await fetchAndCacheAppConfig();
  return cfg?.data_path ?? '';
}

export async function getKeysPath(): Promise<string> {
  const cached = getCachedFullConfig();
  if (cached) return cached.keys_path;
  const cfg = await fetchAndCacheAppConfig();
  return cfg?.keys_path ?? '';
}

// ── SSH defaults ──

export async function getSshDefaults(): Promise<SshDefaultsData> {
  const cached = getStorage<SshDefaultsData | null>(SSH_KEY, null);
  if (cached) return cached;

  // Try extracting from the full config already in localStorage
  const full = getCachedFullConfig();
  if (full) {
    setStorage(SSH_KEY, full.ssh_defaults);
    return full.ssh_defaults;
  }

  // Fetch from API
  const fresh = await fetchAndCacheAppConfig();
  if (fresh) {
    setStorage(SSH_KEY, fresh.ssh_defaults);
    return fresh.ssh_defaults;
  }

  return SSH_FALLBACK;
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
  const cached = getStorage<Record<string, KeyBinding> | null>(HOTKEY_KEY, null);
  if (cached) return cached;

  const full = getCachedFullConfig();
  if (full) {
    setStorage(HOTKEY_KEY, full.hotkey_defaults);
    return full.hotkey_defaults;
  }

  const fresh = await fetchAndCacheAppConfig();
  if (fresh) {
    setStorage(HOTKEY_KEY, fresh.hotkey_defaults);
    return fresh.hotkey_defaults;
  }

  return HOTKEY_FALLBACK;
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
