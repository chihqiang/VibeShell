import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import type { DiskInfo, MonitorEvent } from '@/lib/types';
import type { UnlistenFn } from '@tauri-apps/api/event';

export default function DiskList() {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [disks, setDisks] = useState<DiskInfo[]>([]);
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

    setDisks([]);

    if (!tabId) return;

    const setup = async () => {
      const unlisten = await listen<MonitorEvent>('ssh://monitor', (event) => {
        if (event.payload.tab_id !== tabId || gen !== genRef.current) return;
        setDisks(event.payload.disks);
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
    <div className="border-t border-border/60 flex flex-col min-h-0">
      <div className="overflow-y-auto min-h-0 flex-1">
        <table className="w-full text-[10px] border-collapse">
          <thead className="sticky top-0 bg-secondary">
            <tr className="text-muted-foreground">
              <th className="text-left px-2 py-1 font-medium">{t('monitor.diskPath')}</th>
              <th className="text-right px-2 py-1 font-medium w-[48px]">{t('monitor.diskAvail')}</th>
              <th className="text-right px-2 py-1 font-medium w-[48px]">{t('monitor.diskSize')}</th>
            </tr>
          </thead>
          <tbody>
            {disks.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted-foreground px-2 py-8">
                  {t('monitor.noData')}
                </td>
              </tr>
            ) : (
              disks.map((d, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-2 py-0.5 text-foreground truncate max-w-0">{d.path}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-muted-foreground">{d.avail}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-muted-foreground">{d.size}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
