import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import MonitorInfo from './MonitorInfo';
import ProcessList from './ProcessList';
import DiskList from './DiskList';

const MIN_WIDTH = 180;
const MAX_WIDTH = 500;
const COLLAPSED_WIDTH = 28;

export default function Sidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('vibeshell-sidebar-collapsed');
    return saved === 'true';
  });
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('vibeshell-sidebar-width');
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(saved, 10))) : 256;
  });
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      setIsDragging(true);
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + e.clientX - startX.current));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('vibeshell-sidebar-width', String(width));
  }, [width]);

  useEffect(() => {
    localStorage.setItem('vibeshell-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  return (
    <aside
      className={`bg-secondary border-r border-border/60 flex-shrink-0 flex flex-col relative ${collapsed ? 'overflow-hidden items-center pt-3' : 'overflow-hidden'} ${isDragging ? '' : 'transition-[width] duration-200'}`}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      {collapsed ? (
        <button
          onClick={toggle}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
          title={t('monitor.title')}
        >
          <PanelRightOpen size={16} />
        </button>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('monitor.title')}</h3>
            <button
              onClick={toggle}
              className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
          <MonitorInfo />
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              <ProcessList />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <DiskList />
            </div>
          </div>
        </>
      )}

      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors ${collapsed ? 'hidden' : ''}`}
        onMouseDown={onMouseDown}
      />
    </aside>
  );
}
