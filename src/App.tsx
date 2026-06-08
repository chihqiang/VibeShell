import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/sidebar';
import TrafficLights from '@/components/titlebar/TrafficLights';
import HeaderActions from '@/components/titlebar/HeaderActions';
import { RouteProgress } from '@/components/RouteProgress';
import { guardAutocorrect } from '@/lib/utils';

function App() {
  useEffect(() => guardAutocorrect(), []);
  return (
    <div className="flex flex-col h-screen text-foreground font-sans">
      <RouteProgress />
      <header className="flex-shrink-0 h-9 flex items-center bg-secondary border-b border-border select-none">
        <TrafficLights />

        <div className="flex-1 h-full" data-tauri-drag-region />

        <HeaderActions />
      </header>

      <div className="flex-1 relative min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default App;
