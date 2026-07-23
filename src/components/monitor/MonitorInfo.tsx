import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const max = Math.max(...data, 1);
  const w = SPARKLINE_WIDTH;
  const h = SPARKLINE_HEIGHT;
  const step = w / (MONITOR_MAX_HISTORY - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const fillId = `sparkline-fill-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h} className="flex-shrink-0" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${fillId})`} points={fillPoints} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
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
    <div className="p-4 space-y-3 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">IP</span>
        <span className="text-foreground font-mono truncate ml-2 text-right">{data.ip || '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('monitor.uptime')}</span>
        <span className="text-foreground font-mono ml-2 text-right">
          {formatUptime(data.uptime, uptimeLabels) || '—'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('monitor.load')}</span>
        <span className="text-foreground font-mono ml-2 text-right">{data.load || '—'}</span>
      </div>
      <Bar label="CPU" value={parsePercent(data.cpu)} text={data.cpu ? `${data.cpu}%` : '—'} history={cpuHistory} />
      <Bar
        label={t('monitor.memory')}
        value={parsePercent(data.memory)}
        text={data.memory || '—'}
        history={memHistory}
      />
      <Bar label={t('monitor.swap')} value={parsePercent(data.swap)} text={data.swap || '—'} />
      {data.net_io &&
        (() => {
          const [rx, tx] = data.net_io.split('|');
          const rxNum = parseInt(rx, 10) || 0;
          const txNum = parseInt(tx, 10) || 0;
          return (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('monitor.netIO')}</span>
              <span className="text-foreground font-mono ml-2 text-right">
                ↓{formatSize(rxNum)} ↑{formatSize(txNum)}
              </span>
            </div>
          );
        })()}
    </div>
  );
}
