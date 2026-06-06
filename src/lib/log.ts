import { logMessage } from '@/apis/api/logging';

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
