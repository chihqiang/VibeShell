import { X } from 'lucide-react';
import { cn } from '@/utils';
import { useLayout } from '@/contexts/LayoutContext';
import { useStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import { SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH, SIDE_PANEL_DEFAULT_WIDTH } from '@/constants/layout';
import { useDragResize } from '@/hooks/use-drag-resize';
import { HostSidePanel } from '@/components/host';
import { KeySidePanel } from '@/components/keys';

/** 侧边栏面板 — 根据活动视图显示主机/密钥/设置面板 */
export function SidePanel() {
  const { activeView } = useLayout();
  const [storedWidth, setStoredWidth] = useStorage(STORAGE_KEYS.SIDE_PANEL_WIDTH, SIDE_PANEL_DEFAULT_WIDTH);

  const { size: width, isDragging, handleMouseDown } = useDragResize({
    axis: 'x',
    minSize: SIDE_PANEL_MIN_WIDTH,
    maxSize: SIDE_PANEL_MAX_WIDTH,
    defaultSize: storedWidth,
    onSizeChange: setStoredWidth,
  });

  if (!activeView) return null;

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-secondary border-r border-border/60 flex flex-col relative overflow-hidden',
        isDragging ? '' : 'transition-[width] duration-150',
      )}
      style={{ width }}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        {activeView === 'hosts' && <HostSidePanel />}
        {activeView === 'keys' && <KeySidePanel />}
      </div>

      {/* 拖拽调整宽度 */}
      <div
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/60 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}

/** 面板头部 — 标题 + 关闭按钮 */
export function PanelHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 h-9 border-b border-border/60 relative">
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      {onClose && (
        <button
          onClick={onClose}
          className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
      <div className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </div>
  );
}
