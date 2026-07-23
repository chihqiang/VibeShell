import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { sshConnect, sshDisconnect } from '@/services/sshService';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { ConnectConfig } from '@/contexts/TerminalTabsContext';
import { Terminal as TerminalComp } from '@/components/terminal';
import { WelcomePage } from '@/pages/WelcomePage';
import { TabBar } from '@/components/tabbar';
import { SftpBottomPanel } from '@/components/sftp';
import { useNotify } from '@/hooks/use-notify';
import { getSshDefaults } from '@/services/configService';
import {
  BOTTOM_PANEL_MIN_HEIGHT,
  BOTTOM_PANEL_DEFAULT_HEIGHT,
  DOM_EVENTS,
  TAURI_EVENTS,
  ANSI_RED,
  ANSI_YELLOW,
  ANSI_RESET,
  ANSI_NEWLINE,
  DEFAULT_RECONNECT_MAX_RETRIES,
  DEFAULT_RECONNECT_INITIAL_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
} from '@/constants';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import { useStorage } from '@/utils/storage';
import { useLayout } from '@/contexts/LayoutContext';

/** 编辑器主区域 — 标签栏 + 内容（欢迎页/终端）+ SFTP 底部面板 */
export function EditorArea() {
  const { t } = useTranslation();
  const { tabs, activeTabId, updateStatus, terminalTabVersion } = useTerminalTabs();
  const { sftpOpen } = useLayout();
  const { notifyError } = useNotify();
  const prevSftpOpen = useRef(sftpOpen);
  const connectedTabs = useRef(new Set<string>());
  const abortRef = useRef(new Map<string, AbortController>());
  const [bottomHeight, setBottomHeight] = useStorage(STORAGE_KEYS.SFTP_HEIGHT, BOTTOM_PANEL_DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const dragRafRef = useRef<number | null>(null);
  const dragHeightRef = useRef(0);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const retryCount = useRef(new Map<string, number>());
  const reconnectTimer = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const writeToTerminal = (tabId: string, text: string) => {
    window.dispatchEvent(new CustomEvent(DOM_EVENTS.TERM_WRITE, { detail: { tabId, text } }));
  };
  const reconnectConfig = useRef({
    enabled: true,
    maxRetries: DEFAULT_RECONNECT_MAX_RETRIES,
    initialDelaySecs: DEFAULT_RECONNECT_INITIAL_DELAY,
    maxDelaySecs: DEFAULT_RECONNECT_MAX_DELAY,
  });

  const connectTab = useCallback(
    async (tabId: string, config: ConnectConfig) => {
      if (connectedTabs.current.has(tabId)) return;
      connectedTabs.current.add(tabId);
      updateStatus(tabId, 'connecting');

      const controller = new AbortController();
      abortRef.current.set(tabId, controller);

      try {
        const defaults = await getSshDefaults();
        reconnectConfig.current = {
          enabled: defaults.reconnectEnabled,
          maxRetries: defaults.reconnectMaxRetries,
          initialDelaySecs: defaults.reconnectInitialDelay,
          maxDelaySecs: defaults.reconnectMaxDelay,
        };
        if (controller.signal.aborted) return;
        await sshConnect({
          tabId,
          ...config,
          monitorIntervalSecs: defaults.monitorInterval,
          heartbeatIntervalSecs: defaults.heartbeatInterval,
        });
        if (controller.signal.aborted) return;
        updateStatus(tabId, 'connected');
        retryCount.current.delete(tabId);
      } catch (e) {
        if (controller.signal.aborted) return;
        notifyError(e);
        updateStatus(tabId, 'disconnected');
      } finally {
        connectedTabs.current.delete(tabId);
        abortRef.current.delete(tabId);
      }
    },
    [updateStatus, notifyError],
  );

  useEffect(() => {
    const tabIds = new Set(tabs.map((t) => t.id));
    for (const id of connectedTabs.current) {
      if (!tabIds.has(id)) connectedTabs.current.delete(id);
    }
    for (const tab of tabs) {
      if (tab.type !== 'terminal') continue;
      if (tab.status !== 'disconnected' || connectedTabs.current.has(tab.id)) continue;
      connectTab(tab.id, tab.connectConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalTabVersion, connectTab]);

  useEffect(() => {
    const unlisten = listen<{ tab_id: string; alive: boolean }>(TAURI_EVENTS.SSH_HEARTBEAT, (event) => {
      const { tab_id, alive } = event.payload;
      updateStatus(tab_id, alive ? 'connected' : 'disconnected');

      if (!alive) {
        const cfg = reconnectConfig.current;
        if (!cfg.enabled) return;

        const tab = tabsRef.current.find((t) => t.id === tab_id);
        if (!tab || tab.type !== 'terminal') return;

        const retries = retryCount.current.get(tab_id) || 0;
        if (retries >= cfg.maxRetries) {
          const msg = `${ANSI_NEWLINE}${ANSI_RED}${t('terminal.reconnectMaxRetries')}${ANSI_RESET}${ANSI_NEWLINE}`;
          writeToTerminal(tab_id, msg);
          return;
        }

        const existing = reconnectTimer.current.get(tab_id);
        if (existing) clearTimeout(existing);

        const delay = Math.min(cfg.initialDelaySecs * 1000 * Math.pow(2, retries), cfg.maxDelaySecs * 1000);
        const delaySecs = Math.ceil(delay / 1000);
        const nextRetry = retries + 1;
        const msg = `${ANSI_NEWLINE}${ANSI_YELLOW}${delaySecs}s ${t('terminal.reconnectRetry', { retry: nextRetry, max: cfg.maxRetries })}${ANSI_RESET}${ANSI_NEWLINE}`;
        writeToTerminal(tab_id, msg);

        const timer = setTimeout(() => {
          reconnectTimer.current.delete(tab_id);
          if (!tabsRef.current.find((t) => t.id === tab_id)) return;
          retryCount.current.set(tab_id, retries + 1);
          connectTab(tab_id, tab.connectConfig);
        }, delay);

        reconnectTimer.current.set(tab_id, timer);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateStatus, connectTab, t]);

  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id));
    for (const [id, timer] of reconnectTimer.current) {
      if (!ids.has(id)) {
        clearTimeout(timer);
        reconnectTimer.current.delete(id);
        retryCount.current.delete(id);
      }
    }
    for (const id of retryCount.current.keys()) {
      if (!ids.has(id)) retryCount.current.delete(id);
    }
  }, [tabs]);

  useEffect(() => {
    const abortRefCurrent = abortRef.current;
    const reconnectTimerCurrent = reconnectTimer.current;
    const currentTabs = tabsRef.current;
    return () => {
      for (const ctrl of abortRefCurrent.values()) ctrl.abort();
      for (const timer of reconnectTimerCurrent.values()) clearTimeout(timer);
      reconnectTimerCurrent.clear();
      abortRefCurrent.clear();
      for (const tab of currentTabs) {
        if (tab.type === 'terminal' && tab.status !== 'disconnected') {
          sshDisconnect({ tabId: tab.id }).catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const newH = Math.max(BOTTOM_PANEL_MIN_HEIGHT, startH.current + delta);
      dragHeightRef.current = newH;
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          setBottomHeight(dragHeightRef.current);
        });
      }
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setBottomHeight(dragHeightRef.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (dragRafRef.current !== null) cancelAnimationFrame(dragRafRef.current);
    };
  }, [setBottomHeight]);

  // Notify terminal to refit when SFTP panel opens/closes — the terminal area
  // height changes and xterm needs to recalculate rows/cols + scroll to bottom.
  useEffect(() => {
    if (prevSftpOpen.current === sftpOpen) return;
    prevSftpOpen.current = sftpOpen;
    // Dispatch after a frame so the DOM has settled with the new panel height
    const raf = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.TERM_REFIT));
    });
    return () => cancelAnimationFrame(raf);
  }, [sftpOpen]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startH.current = bottomHeight;
      dragHeightRef.current = bottomHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [bottomHeight],
  );

  const handleReconnect = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab && tab.type === 'terminal') {
        connectTab(tab.id, tab.connectConfig);
      }
    },
    [connectTab],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isTerminalConnected = activeTab?.type === 'terminal' && activeTab.status === 'connected';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabBar onReconnect={handleReconnect} />

      <div className="flex-1 min-h-0 relative flex flex-col">
        {activeTab?.type === 'quick' && <WelcomePage />}
        {tabs.map((tab) =>
          tab.type === 'terminal' ? (
            <TerminalComp
              key={tab.id}
              terminalId={`xterm-${tab.id}`}
              tabId={tab.id}
              status={tab.status}
              active={tab.id === activeTabId}
              className={tab.id !== activeTabId ? 'hidden' : undefined}
              onReconnect={handleReconnect}
            />
          ) : null,
        )}
      </div>

      {isTerminalConnected && (
        <SftpBottomPanel show={sftpOpen} height={bottomHeight} onResizeStart={handleResizeStart} />
      )}
    </div>
  );
}
