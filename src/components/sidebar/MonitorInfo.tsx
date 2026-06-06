import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import type { MonitorData, MonitorEvent, UnlistenFn } from './types';
import { formatUptime, parsePercent } from './utils';

function Bar({ label, value, text }: { label: string; value: number; text: string }) {
  const color = value > 80 ? '#ef4444' : value > 50 ? '#f59e0b' : '#22c55e';

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-mono">{text || '—'}</span>
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
  const { tabs, activeTabId } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [data, setData] = useState<MonitorData>({
    ip: '',
    uptime: '',
    load: '',
    cpu: '',
    memory: '',
    swap: '',
  });
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const genRef = useRef(0);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabId = activeTab?.type === 'terminal' && activeTab.status === 'connected' ? activeTab.id : null;

  useEffect(() => {
    const gen = ++genRef.current;

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    setData({ ip: '', uptime: '', load: '', cpu: '', memory: '', swap: '' });

    if (!tabId) return;

    const setup = async () => {
      const unlisten = await listen<MonitorEvent>('ssh://monitor', (event) => {
        if (event.payload.tab_id !== tabId || gen !== genRef.current) return;
        setData({
          ip: event.payload.ip,
          uptime: event.payload.uptime,
          load: event.payload.load,
          cpu: event.payload.cpu,
          memory: event.payload.memory,
          swap: event.payload.swap,
        });
      });
      if (gen !== genRef.current) {
        unlisten();
        return;
      }
      unlistenRef.current = unlisten;
    };
    setup();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [tabId, notifyError]);

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">IP</span>
        <span className="text-foreground font-mono truncate ml-2 text-right">{data.ip || '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('monitor.uptime')}</span>
        <span className="text-foreground font-mono ml-2 text-right">{formatUptime(data.uptime) || '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('monitor.load')}</span>
        <span className="text-foreground font-mono ml-2 text-right">{data.load || '—'}</span>
      </div>
      <Bar label="CPU" value={parsePercent(data.cpu)} text={data.cpu ? `${data.cpu}%` : '—'} />
      <Bar label={t('monitor.memory')} value={parsePercent(data.memory)} text={data.memory || '—'} />
      <Bar label={t('monitor.swap')} value={parsePercent(data.swap)} text={data.swap || '—'} />
    </div>
  );
}
