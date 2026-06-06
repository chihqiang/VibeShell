export function formatUptime(raw: string): string {
  if (!raw) return '';

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

  if (days > 0 && hours > 0) {
    return `${days}天 ${hours}小时`;
  }
  if (days > 0) {
    return `${days}天`;
  }
  if (hours > 0 && minutes > 0) {
    return `${hours}小时 ${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时`;
  }
  if (minutes > 0) {
    return `${minutes}分钟`;
  }

  return raw;
}

export function parsePercent(raw: string): number {
  if (!raw) return 0;
  const m = raw.match(/\(([\d.]+)%\)/);
  if (m) return parseFloat(m[1]);
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

export function formatMem(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/([\d.]+)(?:MB|GB)\s*\/\s*([\d.]+)(?:MB|GB)/);
  if (m) return `${m[1]}MB / ${m[2]}MB`;
  return raw;
}
