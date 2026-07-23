import { SftpPanel } from '@/components/sftp';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';

interface SftpBottomPanelProps {
  show: boolean;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

export function SftpBottomPanel({ show, height, onResizeStart }: SftpBottomPanelProps) {
  const { activeTabId } = useTerminalTabs();

  if (!show || !activeTabId) return null;

  return (
    <>
      <div
        className="flex-shrink-0 h-[5px] bg-border cursor-row-resize hover:bg-primary/40 active:bg-primary/60 transition-all duration-150 relative"
        onMouseDown={onResizeStart}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-[3px] rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
      </div>
      <div className="flex-shrink-0 flex flex-col bg-background animate-slide-in" style={{ height }}>
        <div className="flex-1 min-h-0">
          <SftpPanel />
        </div>
      </div>
    </>
  );
}
