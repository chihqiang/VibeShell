import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelRightOpen } from 'lucide-react';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { SidePanel } from './SidePanel';
import { StatusBar } from './StatusBar';
import { RouteProgress } from './RouteProgress';
import { MonitorDrawer } from '@/components/monitor';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';

/** 应用主布局 — TopBar + ActivityBar + SidePanel + 编辑器区域 + 监控面板 + 状态栏 */
export function AppLayout() {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTerminalTabs();
  const { monitorOpen, setMonitorOpen } = useLayout();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const hasConnectedTerminal = activeTab?.type === 'terminal' && activeTab.status === 'connected';
  const showMonitorToggle = hasConnectedTerminal && !monitorOpen;

  return (
    <div className="flex flex-col h-screen text-foreground font-sans">
      <RouteProgress />

      {/* 顶部导航栏 */}
      <header className="flex-shrink-0 h-9 flex items-center bg-secondary border-b border-border select-none">
        <TopBar />
      </header>

      {/* 主体区域 */}
      <div className="flex-1 relative min-h-0 flex">
        <ActivityBar />
        <SidePanel />
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <Outlet />
        </div>
        {hasConnectedTerminal && <MonitorDrawer />}

        {/* 右侧监控面板切换按钮 — 监控关闭时显示 */}
        {showMonitorToggle && (
          <button
            onClick={() => setMonitorOpen(true)}
            className="flex-shrink-0 w-7 flex flex-col items-center justify-center gap-1 bg-secondary border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer group"
            title={t('monitor.title')}
          >
            <PanelRightOpen size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium writing-vertical-rl rotate-180 whitespace-nowrap">
              {t('monitor.title')}
            </span>
          </button>
        )}
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  );
}
