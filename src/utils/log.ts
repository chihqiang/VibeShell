import {
  trace as logTrace,
  debug as logDebug,
  info as logInfo,
  warn as logWarn,
  error as logError,
} from '@tauri-apps/plugin-log';
import type { LogLevel } from '@/types/common';

/** 记录日志到后端（经 tauri-plugin-log 统一日志管线） */
export function logMessage(params: { level: LogLevel; message: string }): Promise<void> {
  switch (params.level) {
    case 'error':
      return logError(params.message);
    case 'warn':
      return logWarn(params.message);
    case 'debug':
      return logDebug(params.message);
    case 'trace':
      return logTrace(params.message);
    default:
      return logInfo(params.message);
  }
}

export async function trace(message: string) {
  await logTrace(message);
}

export async function debug(message: string) {
  await logDebug(message);
}

export async function info(message: string) {
  await logInfo(message);
}

export async function warn(message: string) {
  await logWarn(message);
}

export async function error(message: string) {
  await logError(message);
}
