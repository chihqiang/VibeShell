import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skull } from 'lucide-react';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import { useMonitorData } from '@/hooks/use-monitor';
import { sshWrite } from '@/services/sshService';
import type { ProcessInfo } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PROCESS_MAX_DISPLAY, KILL_COMMAND } from '@/constants';

/** 进程列表 — 显示 TOP 进程，支持 kill */
export function ProcessList() {
  const { t } = useTranslation();
  const { activeTabId, tabs } = useTerminalTabs();
  const { notifyError, notify } = useNotify();
  const monitorData = useMonitorData();
  const [killingPid, setKillingPid] = useState<string | null>(null);
  const [confirmKill, setConfirmKill] = useState<{ pid: string; command: string } | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabId = activeTab?.type === 'terminal' && activeTab.status === 'connected' ? activeTab.id : null;
  const processes: ProcessInfo[] = (monitorData?.processes ?? []).slice(0, PROCESS_MAX_DISPLAY);

  const handleKill = (pid: string) => {
    if (!tabId) return;
    setKillingPid(pid);
    const cmd = `${KILL_COMMAND} ${pid}\n`;
    sshWrite({ tabId, data: cmd })
      .then(() => notify(cmd.trim()))
      .catch((e) => notifyError(e))
      .finally(() => setKillingPid(null));
  };

  if (processes.length === 0) {
    return <div className="px-4 py-6 text-center text-[11px] text-muted-foreground/60">{t('monitor.noData')}</div>;
  }

  return (
    <div className="pb-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/20 text-muted-foreground">
            <th className="text-left px-3 py-1.5 font-medium rounded-l-lg">CPU%</th>
            <th className="text-left px-2 py-1.5 font-medium">MEM%</th>
            <th className="text-left px-2 py-1.5 font-medium">{t('monitor.command')}</th>
            <th className="text-right px-2 py-1.5 font-medium">PID</th>
            <th className="rounded-r-lg"></th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p, i) => (
            <tr key={i} className="group hover:bg-muted/40 border-b border-border/20 transition-colors duration-100">
              <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{p.cpu}%</td>
              <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{p.mem}%</td>
              <td className="px-2 py-1 text-foreground truncate max-w-0">{p.command}</td>
              <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{p.pid}</td>
              <td className="px-1 py-1">
                <button
                  onClick={() => setConfirmKill({ pid: p.pid, command: p.command })}
                  disabled={killingPid === p.pid}
                  className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer disabled:opacity-30"
                  title={`${KILL_COMMAND} ${p.pid}`}
                >
                  <Skull size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmKill !== null}
        onOpenChange={(v) => !v && setConfirmKill(null)}
        title={t('monitor.killConfirmTitle')}
        message={t('monitor.killConfirmMessage', {
          pid: confirmKill?.pid ?? '',
          command: confirmKill?.command ?? '',
        })}
        onConfirm={() => {
          if (confirmKill) handleKill(confirmKill.pid);
          setConfirmKill(null);
        }}
        variant="destructive"
      />
    </div>
  );
}
