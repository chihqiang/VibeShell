import { useTranslation } from 'react-i18next';
import { useMonitorData } from '@/hooks/use-monitor';
import { MONITOR_COLORS, MONITOR_DISK_WARN_THRESHOLD, MONITOR_DISK_DANGER_THRESHOLD } from '@/constants';
import type { DiskInfo } from '@/types';

/** 磁盘列表 — 显示磁盘使用率 */
export function DiskList() {
  const { t } = useTranslation();
  const monitorData = useMonitorData();
  const disks: DiskInfo[] = monitorData?.disks ?? [];

  const parseDiskSize = (s: string): number => {
    const m = s.match(/([\d.]+)\s*([KMGT]i?B?|B)/i);
    if (!m) return 0;
    const val = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const mult: Record<string, number> = {
      B: 1,
      KB: 1024,
      KIB: 1024,
      MB: 1024 ** 2,
      MIB: 1024 ** 2,
      GB: 1024 ** 3,
      GIB: 1024 ** 3,
      TB: 1024 ** 4,
      TIB: 1024 ** 4,
    };
    return val * (mult[unit] || 1);
  };

  if (disks.length === 0) {
    return <div className="px-4 py-6 text-center text-[11px] text-muted-foreground/60">{t('monitor.noData')}</div>;
  }

  return (
    <div className="pb-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left px-3 py-1 font-medium">{t('monitor.diskPath')}</th>
            <th className="text-left px-2 py-1 font-medium w-[80px]">{t('monitor.diskUsage', '使用率')}</th>
            <th className="text-right px-2 py-1 font-medium w-[48px]">{t('monitor.diskAvail')}</th>
            <th className="text-right px-3 py-1 font-medium w-[48px]">{t('monitor.diskSize')}</th>
          </tr>
        </thead>
        <tbody>
          {disks.map((d, i) => {
            const totalNum = parseDiskSize(d.size);
            const availNum = parseDiskSize(d.avail);
            const usedPct = totalNum > 0 ? Math.round(((totalNum - availNum) / totalNum) * 100) : 0;
            const barColor =
              usedPct > MONITOR_DISK_DANGER_THRESHOLD
                ? MONITOR_COLORS.danger
                : usedPct > MONITOR_DISK_WARN_THRESHOLD
                  ? MONITOR_COLORS.warn
                  : MONITOR_COLORS.normal;
            return (
              <tr key={i} className="hover:bg-muted/30 transition-colors duration-100">
                <td className="px-3 py-1 text-foreground truncate max-w-0">{d.path}</td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 relative"
                        style={{ width: `${usedPct}%`, backgroundColor: barColor }}
                      >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent" />
                      </div>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">{usedPct}%</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{d.avail}</td>
                <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{d.size}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
