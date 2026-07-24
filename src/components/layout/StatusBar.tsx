import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Wifi, WifiOff, Activity, Folder } from 'lucide-react';
import { cn } from '@/utils';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import { listHosts } from '@/services/hostService';
import type { HostConfig } from '@/types/host';
import { DOM_EVENTS, APP_NAME, SFTP_LABEL } from '@/constants';

/** 底部状态栏 — 显示主机数、连接数等信息 */
export function StatusBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const { toggleSftp, sftpOpen, toggleMonitor, monitorOpen } = useLayout();
  const [hosts, setHosts] = useState<HostConfig[]>([]);

  useEffect(() => {
    const reload = () =>
      listHosts()
        .then(setHosts)
        .catch(() => {});
    reload();
    window.addEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
    return () => window.removeEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
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
        : APP_NAME;

  return (
    <footer className="flex-shrink-0 h-7 flex items-center px-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[11px] select-none gap-1 shadow-[0_-1px_3px_-1px_rgba(0,0,0,0.15)]">
      {/* 左侧：连接状态 */}
      <div className="flex items-center gap-1.5 px-1.5 h-full">
        <span
          className={cn('w-2 h-2 rounded-full', statusColor)}
          style={{
            boxShadow: isConnected
              ? '0 0 6px #22c55e'
              : isConnecting
                ? '0 0 6px #eab308'
                : isTerminal
                  ? '0 0 6px #ef4444'
                  : undefined,
          }}
        />
        <span className="font-medium">{statusText}</span>
      </div>

      <div className="w-px h-3 bg-primary-foreground/15" />

      {/* 主机统计 */}
      <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-primary-foreground/10 transition-all duration-150 cursor-pointer">
        <Server size={11} />
        <span>{t('statusbar.hosts', { count: hosts.length })}</span>
      </button>

      <div className="w-px h-3 bg-primary-foreground/15" />

      {/* 连接统计 */}
      <button className="flex items-center gap-1.5 px-1.5 h-full hover:bg-primary-foreground/10 transition-all duration-150 cursor-pointer">
        {connectedCount > 0 ? <Wifi size={11} /> : <WifiOff size={11} />}
        <span>{t('statusbar.connected', { count: connectedCount })}</span>
      </button>

      <div className="flex-1" />

      {/* 右侧：面板切换按钮 */}
      {isConnected && (
        <>
          <button
            onClick={toggleSftp}
            className={cn(
              'flex items-center gap-1 px-1.5 h-full hover:bg-primary-foreground/10 transition-all duration-150 cursor-pointer',
              sftpOpen && 'bg-primary-foreground/15',
            )}
            title={SFTP_LABEL}
          >
            <Folder size={11} />
            <span>{SFTP_LABEL}</span>
          </button>

          <div className="w-px h-3 bg-primary-foreground/15" />

          <button
            onClick={toggleMonitor}
            className={cn(
              'flex items-center gap-1 px-1.5 h-full hover:bg-primary-foreground/10 transition-all duration-150 cursor-pointer',
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
