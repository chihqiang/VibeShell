import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, ChevronDown, ChevronRight, Activity, HardDrive, Cpu, PanelRightClose } from 'lucide-react';
import { cn } from '@/utils';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useStorage } from '@/utils/storage';
import { MONITOR_DRAWER_WIDTH, STORAGE_KEYS } from '@/constants';
import { MonitorInfo } from './MonitorInfo';
import { ProcessList } from './ProcessList';
import { DiskList } from './DiskList';

const CollapsibleSection = memo(function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  storageKey,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useStorage(storageKey, defaultOpen);

  return (
    <div className="border-b border-border/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full h-8 px-4 text-left hover:bg-muted/40 transition-colors cursor-pointer group"
      >
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</span>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">{title}</span>
        {open ? (
          <ChevronDown size={13} className="text-muted-foreground/60" />
        ) : (
          <ChevronRight size={13} className="text-muted-foreground/60" />
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
});

/** 监控面板 — 系统信息、进程列表、磁盘列表，由 LayoutContext 控制开关 */
export function MonitorDrawer() {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const { monitorOpen, setMonitorOpen } = useLayout();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isConnected = activeTab?.type === 'terminal' && activeTab.status === 'connected';
  const hostName = activeTab?.type === 'terminal' ? activeTab.host?.name : undefined;
  const hostAddr =
    activeTab?.type === 'terminal'
      ? `${activeTab.connectConfig.username}@${activeTab.connectConfig.hostname}`
      : undefined;

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-secondary border-l border-border/60 flex flex-col overflow-hidden relative',
        'transition-[width] duration-200',
      )}
      style={{ width: monitorOpen ? MONITOR_DRAWER_WIDTH : 0 }}
    >
      <div className="h-full flex flex-col" style={{ width: MONITOR_DRAWER_WIDTH }}>
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('monitor.title')}</h3>
          <button
            onClick={() => setMonitorOpen(false)}
            className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={t('common.close')}
          >
            <PanelRightClose size={14} />
          </button>
        </div>

        {isConnected && (
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2.5 bg-primary/5 flex-shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 flex-shrink-0">
              <Server size={14} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">{hostName || hostAddr}</div>
              {hostName && <div className="text-[11px] text-muted-foreground truncate font-mono">{hostAddr}</div>}
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
          </div>
        )}

        {isConnected ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <CollapsibleSection
              title={t('monitor.systemInfo')}
              icon={<Activity size={13} />}
              storageKey={STORAGE_KEYS.MONITOR_SECTION_SYSTEM}
            >
              <MonitorInfo />
            </CollapsibleSection>
            <CollapsibleSection
              title={t('monitor.processes')}
              icon={<Cpu size={13} />}
              storageKey={STORAGE_KEYS.MONITOR_SECTION_PROCESSES}
            >
              <ProcessList />
            </CollapsibleSection>
            <CollapsibleSection
              title={t('monitor.disks')}
              icon={<HardDrive size={13} />}
              storageKey={STORAGE_KEYS.MONITOR_SECTION_DISKS}
              defaultOpen={false}
            >
              <DiskList />
            </CollapsibleSection>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted/50">
              <Server size={22} className="text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t('monitor.noConnection')}</p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              {t('monitor.noConnectionHint')}
            </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
