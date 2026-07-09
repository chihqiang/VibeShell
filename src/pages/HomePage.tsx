import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { sshConnect, sshDisconnect } from '@/apis/api/ssh';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { ConnectConfig } from '@/contexts/TerminalTabsContext';
import TerminalComp from '@/components/terminal';
import QuickConnect from '@/components/host/QuickConnect';
import TabBar from '@/components/tabbar';
import SftpBottomPanel from '@/components/sftp/SftpBottomPanel';
import { useNotify } from '@/hooks/use-notify';
import { getSshDefaults } from '@/storage/config';
import { BOTTOM_PANEL_MIN, BOTTOM_PANEL_DEFAULT } from '@/lib/types';
import { useStorage } from '@/lib/storage';

const SFTP_OPEN_KEY = 'vibeshell-sftp-open';
const SFTP_HEIGHT_KEY = 'vibeshell-sftp-height';

export default function HomePage() {
  const { t } = useTranslation();
  const { tabs, activeTabId, updateStatus, terminalTabVersion } = useTerminalTabs();
  const { notifyError } = useNotify();
  const connectedTabs = useRef(new Set<string>());
  const abortRef = useRef(new Map<string, AbortController>());
  const [showSftp, setShowSftp] = useStorage(SFTP_OPEN_KEY, false);
  const [bottomHeight, setBottomHeight] = useStorage(SFTP_HEIGHT_KEY, BOTTOM_PANEL_DEFAULT);
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
  // Helper to write text to a terminal via custom event (consumed by Terminal component)
  const writeToTerminal = (tabId: string, text: string) => {
    window.dispatchEvent(new CustomEvent('vibeshell:term-write', { detail: { tabId, text } }));
  };
  const reconnectConfig = useRef({
    enabled: true,
    maxRetries: 10,
    initialDelaySecs: 1,
    maxDelaySecs: 30,
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

  // Connect new terminal tabs — fires on addTerminalTab/convertTabToTerminal
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

  // Heartbeat — listen for session alive/dead events, auto-reconnect on disconnect
  useEffect(() => {
    const unlisten = listen<{ tab_id: string; alive: boolean }>('ssh://heartbeat', (event) => {
      const { tab_id, alive } = event.payload;
      updateStatus(tab_id, alive ? 'connected' : 'disconnected');

      if (!alive) {
        const cfg = reconnectConfig.current;
        if (!cfg.enabled) return;

        const tab = tabsRef.current.find((t) => t.id === tab_id);
        if (!tab || tab.type !== 'terminal') return;

        const retries = retryCount.current.get(tab_id) || 0;
        if (retries >= cfg.maxRetries) {
          const msg = `\r\n\x1b[31m${t('terminal.reconnectMaxRetries', '已达最大重试次数，请手动重连')}\x1b[0m\r\n`;
          writeToTerminal(tab_id, msg);
          return;
        }

        const existing = reconnectTimer.current.get(tab_id);
        if (existing) clearTimeout(existing);

        const delay = Math.min(cfg.initialDelaySecs * 1000 * Math.pow(2, retries), cfg.maxDelaySecs * 1000);
        const delaySecs = Math.ceil(delay / 1000);
        const nextRetry = retries + 1;
        const msg = `\r\n\x1b[33m${delaySecs}s ${t('terminal.reconnectRetry', { retry: nextRetry, max: cfg.maxRetries, defaultValue: `后第 ${nextRetry}/${cfg.maxRetries} 次自动重连...` })}\x1b[0m\r\n`;
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

  // Cleanup orphaned entries on tab removal
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

  // Cleanup timers/abort-controllers and disconnect SSH sessions on unmount
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
      const newH = Math.max(BOTTOM_PANEL_MIN, startH.current + delta);
      dragHeightRef.current = newH;
      // RAF throttle: only one React state update per frame
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
      // Cancel pending RAF and persist final value to localStorage
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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = bottomHeight;
    dragHeightRef.current = bottomHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [bottomHeight]);

  // Stable callback for reconnect — avoids breaking TerminalComp's memo
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabBar onReconnect={handleReconnect} />

      <div className="flex-1 min-h-0 relative">
        {activeTab?.type === 'quick' && <QuickConnect />}
        {tabs.map((tab) =>
          tab.type === 'terminal' ? (
            <TerminalComp
              key={tab.id}
              terminalId={`xterm-${tab.id}`}
              tabId={tab.id}
              status={tab.status}
              active={tab.id === activeTabId}
              className={tab.id !== activeTabId ? 'hidden' : undefined}
              onReconnect={() => handleReconnect(tab.id)}
            />
          ) : null,
        )}
      </div>

      {activeTab?.type === 'terminal' && activeTab.status === 'connected' && (
        <SftpBottomPanel
          show={showSftp}
          onToggle={setShowSftp}
          height={bottomHeight}
          onResizeStart={handleResizeStart}
        />
      )}
    </div>
  );
}
