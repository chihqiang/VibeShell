import { Folder, ChevronDown, ChevronUp } from 'lucide-react';
import SftpPanel from '@/components/sftp/SftpPanel';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';

interface SftpBottomPanelProps {
  show: boolean;
  onToggle: (v: boolean) => void;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

export default function SftpBottomPanel({ show, onToggle, height, onResizeStart }: SftpBottomPanelProps) {
  const { tabs, activeTabId } = useTerminalTabs();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const config = activeTab?.type === 'terminal' ? activeTab.connectConfig : undefined;

  return (
    <>
      <button
        onClick={() => onToggle(!show)}
        className="flex-shrink-0 flex items-center gap-2 h-7 px-3 bg-secondary/30 border-t border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
      >
        <Folder size={12} />
        <span className="font-medium">SFTP</span>
        <span className="text-muted-foreground/70">
          {config?.username}@{config?.hostname}:{config?.port}
        </span>
        <span className="ml-auto">{show ? <ChevronDown size={12} /> : <ChevronUp size={12} />}</span>
      </button>

      {show && activeTabId && (
        <>
          <div
            className="flex-shrink-0 h-[5px] bg-border cursor-row-resize hover:bg-primary/40 active:bg-primary/60 transition-colors relative"
            onMouseDown={onResizeStart}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[3px] rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex-shrink-0 flex flex-col bg-background animate-slide-in" style={{ height }}>
            <div className="flex-1 min-h-0">
              <SftpPanel />
            </div>
          </div>
        </>
      )}
    </>
  );
}
