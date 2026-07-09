import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Wifi, WifiOff, Activity, Folder } from 'lucide-react';
import { cn } from '@/utils';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import { listHosts } from '@/services/hostService';
import type { HostConfig } from '@/types/host';

/** 底部状态栏 — 显示主机数、连接数等信息 */
export function StatusBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const { toggleSftp, sftpOpen, toggleMonitor, monitorOpen } = useLayout();
  const [hosts, setHosts] = useState<HostConfig[]>([]);

  useEffect(() => {
    listHosts().then(setHosts).catch(() => {});
  }, []);

  const connectedCount = useMemo(
    () => tabs.filter((tab) => tab.type === 'terminal' && tab.status === 'connected').length,
    [tabs],
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const isTerminal = activeTab?.type === 'terminal';
  const isConnected = isTerminal && activeTab.status === 'connected';
  const isConnecting = isTerminal && activeTab.status === 'connecting';

  const statusColor = isConnected
    ? 'bg-green-500'
    : isConnecting
      ? 'bg-yellow-500'
      : isTerminal
        ? 'bg-red-500'
        : 'bg-muted-foreground/40';

  const statusText = isConnected
    ? t('terminal.connectedSuccess')
    : isConnecting
      ? t('connection.connecting')
      : isTerminal
        ? t('terminal.disconnected')
        : 'VibeShell';

  return (
    <footer className="flex-shrink-0 h-6 flex items-center px-2 bg-primary text-primary-foreground text-[11px] select-none gap-1">
      {/* 左侧：连接状态 */}
      <div className="flex items-center gap-1.5 px-1.5 h-full">
        <span className={cn('w-2 h-2 rounded-full', statusColor)} />
        <span className="font-medium">{statusText}</span>
      </div>

      <div className="w-px h-3 bg-primary-foreground/20" />

      {/* 主机统计 */}
      <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-primary-foreground/10 transition-colors cursor-pointer">
        <Server size={11} />
        <span>{t('statusbar.hosts', { count: hosts.length, defaultValue: `${hosts.length} 台主机` })}</span>
      </button>

      <div className="w-px h-3 bg-primary-foreground/20" />

      {/* 连接统计 */}
      <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-primary-foreground/10 transition-colors cursor-pointer">
        {connectedCount > 0 ? <Wifi size={11} /> : <WifiOff size={11} />}
        <span>
          {t('statusbar.connected', { count: connectedCount, defaultValue: `已连接 ${connectedCount} 台` })}
        </span>
      </button>

      <div className="flex-1" />

      {/* 右侧：面板切换按钮 */}
      {isTerminal && (
        <>
          <button
            onClick={toggleSftp}
            className={cn(
              'flex items-center gap-1 px-1.5 h-full hover:bg-primary-foreground/10 transition-colors cursor-pointer',
              sftpOpen && 'bg-primary-foreground/15',
            )}
            title="SFTP"
          >
            <Folder size={11} />
            <span>SFTP</span>
          </button>

          <div className="w-px h-3 bg-primary-foreground/20" />

          <button
            onClick={toggleMonitor}
            className={cn(
              'flex items-center gap-1 px-1.5 h-full hover:bg-primary-foreground/10 transition-colors cursor-pointer',
              monitorOpen && 'bg-primary-foreground/15',
            )}
            title={t('monitor.title')}
          >
            <Activity size={11} />
            <span>{t('monitor.title')}</span>
          </button>
        </>
      )}
    </footer>
  );
}
