import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';

/** 侧边栏活动视图类型 */
export type ActivityView = 'hosts' | 'keys';

/** 布局上下文值 */
interface LayoutContextValue {
  /** 当前活动的侧边栏视图 */
  activeView: ActivityView | null;
  /** 侧边栏面板是否展开 */
  sidePanelOpen: boolean;
  /** 监控面板是否展开 */
  monitorOpen: boolean;
  /** SFTP 底部面板是否展开 */
  sftpOpen: boolean;
  /** 切换活动视图（点击相同图标可收起） */
  toggleView: (view: ActivityView) => void;
  /** 设置活动视图 */
  setActiveView: (view: ActivityView | null) => void;
  /** 设置侧边栏面板展开状态 */
  setSidePanelOpen: (open: boolean) => void;
  /** 切换监控面板 */
  toggleMonitor: () => void;
  /** 设置监控面板展开状态 */
  setMonitorOpen: (open: boolean) => void;
  /** 切换 SFTP 面板 */
  toggleSftp: () => void;
  /** 设置 SFTP 面板展开状态 */
  setSftpOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

/** 布局状态 Provider — 管理侧边栏、监控面板、SFTP 面板的展开状态 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveViewState] = useState<ActivityView | null>(null);
  const [monitorOpen, setMonitorOpenState] = useStorage(STORAGE_KEYS.MONITOR_OPEN, true);
  const [sftpOpen, setSftpOpen] = useStorage(STORAGE_KEYS.SFTP_OPEN, false);

  const toggleView = useCallback(
    (view: ActivityView) => {
      setActiveViewState((prev) => {
        if (prev === view) return null;
        return view;
      });
    },
    [],
  );

  const setActiveView = useCallback((view: ActivityView | null) => {
    setActiveViewState(view);
  }, []);

  const setSidePanelOpen = useCallback((open: boolean) => {
    if (!open) setActiveViewState(null);
  }, []);

  const toggleMonitor = useCallback(() => {
    setMonitorOpenState(!monitorOpen);
  }, [monitorOpen, setMonitorOpenState]);

  const setMonitorOpen = useCallback(
    (open: boolean) => setMonitorOpenState(open),
    [setMonitorOpenState],
  );

  const toggleSftp = useCallback(() => {
    setSftpOpen(!sftpOpen);
  }, [sftpOpen, setSftpOpen]);

  const sidePanelOpen = activeView !== null;

  const contextValue = useMemo<LayoutContextValue>(
    () => ({
      activeView,
      sidePanelOpen,
      monitorOpen,
      sftpOpen,
      toggleView,
      setActiveView,
      setSidePanelOpen,
      toggleMonitor,
      setMonitorOpen,
      toggleSftp,
      setSftpOpen,
    }),
    [
      activeView,
      sidePanelOpen,
      monitorOpen,
      sftpOpen,
      toggleView,
      setActiveView,
      setSidePanelOpen,
      toggleMonitor,
      setMonitorOpen,
      toggleSftp,
      setSftpOpen,
    ],
  );

  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
