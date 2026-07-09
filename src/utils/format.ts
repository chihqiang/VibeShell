import { FILE_SIZE_BASE } from '@/constants/app';

/** 格式化文件大小 */
export function formatSize(size: number): string {
  if (size < FILE_SIZE_BASE) return `${size} B`;
  if (size < FILE_SIZE_BASE * FILE_SIZE_BASE) return `${(size / FILE_SIZE_BASE).toFixed(1)} KB`;
  if (size < FILE_SIZE_BASE ** 3) return `${(size / FILE_SIZE_BASE ** 2).toFixed(1)} MB`;
  if (size < FILE_SIZE_BASE ** 4) return `${(size / FILE_SIZE_BASE ** 3).toFixed(1)} GB`;
  return `${(size / FILE_SIZE_BASE ** 4).toFixed(1)} TB`;
}

/** 解析 uptime 字符串 */
function parseUptime(raw: string): { days: number; hours: number; minutes: number } | null {
  if (!raw) return null;
  const re = /up\s+(.*)/;
  const m = raw.match(re);
  const input = m ? m[1] : raw;
  let days = 0,
    hours = 0,
    minutes = 0;
  const dayRe = /(\d+)\s*days?/;
  const hourRe = /(\d+)\s*hours?/;
  const minRe = /(\d+)\s*minutes?/;
  const dayMatch = input.match(dayRe);
  const hourMatch = input.match(hourRe);
  const minMatch = input.match(minRe);
  if (dayMatch) days = parseInt(dayMatch[1], 10);
  if (hourMatch) hours = parseInt(hourMatch[1], 10);
  if (minMatch) minutes = parseInt(minMatch[1], 10);
  if (days === 0 && hours === 0 && minutes === 0) return null;
  return { days, hours, minutes };
}

/** 格式化 uptime */
export function formatUptime(raw: string, labels: { day: string; hour: string; minute: string }): string {
  const parsed = parseUptime(raw);
  if (!parsed) return raw || '';
  const { days, hours, minutes } = parsed;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${labels.day}`);
  if (hours > 0) parts.push(`${hours}${labels.hour}`);
  if (minutes > 0) parts.push(`${minutes}${labels.minute}`);
  return parts.join(' ');
}

/** 解析百分比字符串 */
export function parsePercent(raw: string): number {
  if (!raw) return 0;
  const m = raw.match(/\(([\d.]+)%\)/);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}
