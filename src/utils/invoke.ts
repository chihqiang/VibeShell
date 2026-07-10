import { invoke as tauriInvoke } from '@tauri-apps/api/core';

/** 封装 Tauri invoke 调用 */
export function invoke<T>(cmd: string, args?: object): Promise<T> {
  return tauriInvoke(cmd, args as Record<string, unknown>);
}
