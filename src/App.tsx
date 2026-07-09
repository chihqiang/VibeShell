import { useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import HostSidebar from '@/components/host/HostSidebar';
import MonitorDrawer from '@/components/sidebar/MonitorDrawer';
import TrafficLights from '@/components/titlebar/TrafficLights';
import HeaderActions from '@/components/titlebar/HeaderActions';
import { RouteProgress } from '@/components/RouteProgress';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';

function App() {
  const { tabs } = useTerminalTabs();

  // Monitor panel auto-opens when a terminal is connected, auto-closes when none are
  const hasConnectedTerminal = useMemo(
    () => tabs.some((t) => t.type === 'terminal' && t.status === 'connected'),
    [tabs],
  );

  return (
    <div className="flex flex-col h-screen text-foreground font-sans">
      <RouteProgress />
      <header className="flex-shrink-0 h-9 flex items-center bg-secondary border-b border-border select-none">
        <TrafficLights />

        <div className="flex-1 h-full" data-tauri-drag-region />

        <HeaderActions />
      </header>

      <div className="flex-1 relative min-h-0 flex">
        <HostSidebar />
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <Outlet />
        </div>
        <MonitorDrawer open={hasConnectedTerminal} />
      </div>
    </div>
  );
}

export default App;
