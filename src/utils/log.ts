import { invoke } from '@/utils/invoke';
import type { LogLevel } from '@/types/common';

/** 记录日志到后端 */
export function logMessage(params: { level: LogLevel; message: string }): Promise<void> {
  return invoke('log_message', params);
}

export async function trace(message: string) {
  await logMessage({ level: 'trace', message });
}

export async function debug(message: string) {
  await logMessage({ level: 'debug', message });
}

export async function info(message: string) {
  await logMessage({ level: 'info', message });
}

export async function warn(message: string) {
  await logMessage({ level: 'warn', message });
}

export async function error(message: string) {
  await logMessage({ level: 'error', message });
}
