import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, KeyRound, Settings } from 'lucide-react';
import { cn } from '@/utils';
import { useLayout, type ActivityView } from '@/contexts/LayoutContext';
import { ACTIVITY_BAR_WIDTH } from '@/constants/layout';
import { SettingsDialog } from '@/components/settings';

interface ActivityItem {
  id: ActivityView;
  icon: React.ReactNode;
  labelKey: string;
}

const topItems: ActivityItem[] = [
  { id: 'hosts', icon: <Server size={22} />, labelKey: 'sidebar.hostManagement' },
  { id: 'keys', icon: <KeyRound size={22} />, labelKey: 'sidebar.keyManagement' },
];

/** Activity Bar — VSCode 风格的垂直图标导航栏 */
export function ActivityBar() {
  const { t } = useTranslation();
  const { activeView, toggleView } = useLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const renderItem = (item: ActivityItem) => {
    const isActive = activeView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => toggleView(item.id)}
        title={t(item.labelKey)}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 cursor-pointer relative group',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[1px_0_4px_rgba(0,0,0,0.15)]" />
        )}
        <span className="transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
      </button>
    );
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center py-2 bg-secondary border-r border-border/60 select-none"
      style={{ width: ACTIVITY_BAR_WIDTH }}
    >
      <div className="flex flex-col gap-1">{topItems.map(renderItem)}</div>
      <div className="flex-1" />
      <div className="flex flex-col gap-1">
        <button
          onClick={() => setSettingsOpen(true)}
          title={t('settings.title')}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 cursor-pointer relative group',
            'text-muted-foreground hover:text-foreground hover:bg-muted/70',
          )}
        >
          <span className="transition-transform duration-200 group-hover:scale-110">
            <Settings size={22} />
          </span>
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
