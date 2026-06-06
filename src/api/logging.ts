import { invoke } from '@tauri-apps/api/core';

export function logMessage(params: {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
}): Promise<void> {
  return invoke('log_message', params);
}
