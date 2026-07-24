import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart } from 'recharts';
import { useMonitorData } from '@/hooks/use-monitor';
import { formatUptime, parsePercent, formatSize } from '@/utils';
import {
  MONITOR_MAX_HISTORY,
  MONITOR_WARN_THRESHOLD,
  MONITOR_DANGER_THRESHOLD,
  MONITOR_COLORS,
  SPARKLINE_WIDTH,
  SPARKLINE_HEIGHT,
} from '@/constants';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const chartData = data.map((v) => ({ v }));
  const gradientId = `sg-${color.replace('#', '')}`;
  return (
    <AreaChart
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      data={chartData}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Area
        type="linear"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#${gradientId})`}
        isAnimationActive={false}
        dot={false}
        activeDot={false}
      />
    </AreaChart>
  );
}

function Bar({ label, value, text, history }: { label: string; value: number; text: string; history?: number[] }) {
  const color =
    value > MONITOR_DANGER_THRESHOLD
      ? MONITOR_COLORS.danger
      : value > MONITOR_WARN_THRESHOLD
        ? MONITOR_COLORS.warn
        : MONITOR_COLORS.normal;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {history && history.length >= 2 && <Sparkline data={history} color={color} />}
          <span className="text-foreground font-mono">{text || '—'}</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden border border-border/60 bg-muted/30">
        <div
          className="h-full rounded-full transition-all duration-500 relative"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** 监控信息 — CPU、内存、Swap、网络 IO 等 */
export function MonitorInfo() {
  const { t } = useTranslation();
  const monitorData = useMonitorData();

  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const pendingCpuRef = useRef<number | null>(null);
  const pendingMemRef = useRef<number | null>(null);

  useEffect(() => {
    if (!monitorData) {
      setCpuHistory([]);
      setMemHistory([]);
      return;
    }

    const cpuVal = parsePercent(monitorData.cpu);
    const memVal = parsePercent(monitorData.memory);
    pendingCpuRef.current = cpuVal;
    pendingMemRef.current = memVal;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const cv = pendingCpuRef.current;
        const mv = pendingMemRef.current;
        if (cv !== null) setCpuHistory((prev) => [...prev, cv].slice(-MONITOR_MAX_HISTORY));
        if (mv !== null) setMemHistory((prev) => [...prev, mv].slice(-MONITOR_MAX_HISTORY));
      });
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [monitorData]);

  const uptimeLabels = { day: t('common.day'), hour: t('common.hour'), minute: t('common.minute') };

  const data = monitorData ?? { ip: '', uptime: '', load: '', cpu: '', memory: '', swap: '', net_io: '' };

  return (
    <div className="p-3 space-y-3 text-xs">
      {/* 系统信息卡片 */}
      <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">IP</span>
          <span className="text-foreground font-mono text-xs">{data.ip || '—'}</span>
        </div>
        <div className="h-px bg-border/30" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">{t('monitor.uptime')}</span>
          <span className="text-foreground font-mono text-xs">
            {formatUptime(data.uptime, uptimeLabels) || '—'}
          </span>
        </div>
        <div className="h-px bg-border/30" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">{t('monitor.load')}</span>
          <span className="text-foreground font-mono text-xs">{data.load || '—'}</span>
        </div>
      </div>

      {/* 资源使用率 */}
      <Bar label="CPU" value={parsePercent(data.cpu)} text={data.cpu ? `${data.cpu}%` : '—'} history={cpuHistory} />
      <Bar
        label={t('monitor.memory')}
        value={parsePercent(data.memory)}
        text={data.memory || '—'}
        history={memHistory}
      />
      <Bar label={t('monitor.swap')} value={parsePercent(data.swap)} text={data.swap || '—'} />

      {/* 网络 IO 卡片 */}
      {data.net_io &&
        (() => {
          const [rx, tx] = data.net_io.split('|');
          const rxNum = parseInt(rx, 10) || 0;
          const txNum = parseInt(tx, 10) || 0;
          return (
            <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">{t('monitor.netIO')}</span>
                <span className="text-foreground font-mono text-xs">
                  ↓{formatSize(rxNum)} ↑{formatSize(txNum)}
                </span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
