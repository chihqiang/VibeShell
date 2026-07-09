import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skull } from 'lucide-react';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import { useMonitorData } from '@/hooks/use-monitor';
import { sshWrite } from '@/apis/api/ssh';
import type { ProcessInfo } from '@/lib/types';
import ConfirmDialog from '@/components/sftp/dialogs/ConfirmDialog';

const MAX_PROCESSES = 8;

export default function ProcessList() {
  const { t } = useTranslation();
  const { activeTabId, tabs } = useTerminalTabs();
  const { notifyError, notify } = useNotify();
  const monitorData = useMonitorData();
  const [killingPid, setKillingPid] = useState<string | null>(null);
  const [confirmKill, setConfirmKill] = useState<{ pid: string; command: string } | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabId = activeTab?.type === 'terminal' && activeTab.status === 'connected' ? activeTab.id : null;
  const processes: ProcessInfo[] = (monitorData?.processes ?? []).slice(0, MAX_PROCESSES);

  const handleKill = (pid: string) => {
    if (!tabId) return;
    setKillingPid(pid);
    sshWrite({ tabId, data: `kill -9 ${pid}\n` })
      .then(() => notify(`kill -9 ${pid}`))
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
          <tr className="text-muted-foreground">
            <th className="text-left px-3 py-1 font-medium w-[42px]">CPU%</th>
            <th className="text-left px-2 py-1 font-medium w-[42px]">MEM%</th>
            <th className="text-left px-2 py-1 font-medium">{t('monitor.command')}</th>
            <th className="text-right px-2 py-1 font-medium w-[40px]">PID</th>
            <th className="w-[28px]"></th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p, i) => (
            <tr key={i} className="group hover:bg-muted/30">
              <td className="px-3 py-0.5 text-right tabular-nums text-muted-foreground">{p.cpu}%</td>
              <td className="px-2 py-0.5 text-right tabular-nums text-muted-foreground">{p.mem}%</td>
              <td className="px-2 py-0.5 text-foreground truncate max-w-0">{p.command}</td>
              <td className="px-2 py-0.5 text-right tabular-nums text-muted-foreground">{p.pid}</td>
              <td className="px-1 py-0.5">
                <button
                  onClick={() => setConfirmKill({ pid: p.pid, command: p.command })}
                  disabled={killingPid === p.pid}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer disabled:opacity-30"
                  title={`kill -9 ${p.pid}`}
                >
                  <Skull size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmKill !== null}
        onOpenChange={(v) => !v && setConfirmKill(null)}
        title={t('monitor.killConfirmTitle', { defaultValue: '确认终止进程' })}
        message={t('monitor.killConfirmMessage', {
          pid: confirmKill?.pid ?? '',
          command: confirmKill?.command ?? '',
          defaultValue: `确认执行 kill -9 ${confirmKill?.pid ?? ''} 终止进程「${confirmKill?.command ?? ''}」吗？`,
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
