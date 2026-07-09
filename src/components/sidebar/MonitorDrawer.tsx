import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, ChevronDown, ChevronRight, Activity, HardDrive, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useStorage } from '@/lib/storage';
import MonitorInfo from './MonitorInfo';
import ProcessList from './ProcessList';
import DiskList from './DiskList';

export interface MonitorDrawerProps {
  open: boolean;
}

const DRAWER_WIDTH = 300;

// --- Collapsible section ---
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
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">
          {title}
        </span>
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

export default function MonitorDrawer({ open }: MonitorDrawerProps) {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isConnected = activeTab?.type === 'terminal' && activeTab.status === 'connected';
  const hostName = activeTab?.type === 'terminal' ? activeTab.host?.name : undefined;
  const hostAddr = activeTab?.type === 'terminal'
    ? `${activeTab.connectConfig.username}@${activeTab.connectConfig.hostname}`
    : undefined;

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-secondary border-l border-border/60 flex flex-col overflow-hidden',
        'transition-[width] duration-200',
      )}
      style={{ width: open ? DRAWER_WIDTH : 0 }}
    >
      {/* Fixed-width inner wrapper prevents content reflow during width animation */}
      <div className="h-full flex flex-col" style={{ width: DRAWER_WIDTH }}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t('monitor.title')}
          </h3>
          {isConnected && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
          )}
        </div>

        {/* Host info banner — only when connected */}
        {isConnected && (
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2.5 bg-primary/5 flex-shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 flex-shrink-0">
              <Server size={14} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">{hostName || hostAddr}</div>
              {hostName && (
                <div className="text-[11px] text-muted-foreground truncate font-mono">{hostAddr}</div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {isConnected ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <CollapsibleSection
              title={t('monitor.systemInfo', '系统信息')}
              icon={<Activity size={13} />}
              storageKey="vibeshell-monitor-section-system"
            >
              <MonitorInfo />
            </CollapsibleSection>
            <CollapsibleSection
              title={t('monitor.processes', '进程')}
              icon={<Cpu size={13} />}
              storageKey="vibeshell-monitor-section-processes"
            >
              <ProcessList />
            </CollapsibleSection>
            <CollapsibleSection
              title={t('monitor.disks', '磁盘')}
              icon={<HardDrive size={13} />}
              storageKey="vibeshell-monitor-section-disks"
              defaultOpen={false}
            >
              <DiskList />
            </CollapsibleSection>
          </div>
        ) : (
          /* Empty state — no active connection */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted/50">
              <Server size={22} className="text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('monitor.noConnection', '暂无活跃连接')}
              </p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                {t('monitor.noConnectionHint', '连接到服务器后即可查看实时监控数据')}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
