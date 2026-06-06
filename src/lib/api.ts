import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export function invoke<T>(cmd: string, args?: object): Promise<T> {
  return tauriInvoke(cmd, args as Record<string, unknown>);
}
