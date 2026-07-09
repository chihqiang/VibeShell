import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMonitorData } from '@/hooks/use-monitor';
import { formatUptime, parsePercent, formatSize } from '@/lib/utils';

const MAX_HISTORY = 30;

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 20;
  const step = w / (MAX_HISTORY - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Bar({ label, value, text, history }: { label: string; value: number; text: string; history?: number[] }) {
  const color = value > 80 ? '#ef4444' : value > 50 ? '#f59e0b' : '#22c55e';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {history && history.length >= 2 && <Sparkline data={history} color={color} />}
          <span className="text-foreground font-mono">{text || '—'}</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden border border-border/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MonitorInfo() {
  const { t } = useTranslation();
  const monitorData = useMonitorData();

  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const pendingCpuRef = useRef<number | null>(null);
  const pendingMemRef = useRef<number | null>(null);

  // RAF-throttled history updates — avoids 2 setState per monitor tick
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
        if (cv !== null) setCpuHistory((prev) => [...prev, cv].slice(-MAX_HISTORY));
        if (mv !== null) setMemHistory((prev) => [...prev, mv].slice(-MAX_HISTORY));
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
      <Bar label={t('monitor.memory')} value={parsePercent(data.memory)} text={data.memory || '—'} history={memHistory} />
      <Bar label={t('monitor.swap')} value={parsePercent(data.swap)} text={data.swap || '—'} />
      {data.net_io && (() => {
        const [rx, tx] = data.net_io.split('|');
        const rxNum = parseInt(rx, 10) || 0;
        const txNum = parseInt(tx, 10) || 0;
        return (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('monitor.netIO', 'Net I/O')}</span>
            <span className="text-foreground font-mono ml-2 text-right">
              ↓{formatSize(rxNum)} ↑{formatSize(txNum)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
