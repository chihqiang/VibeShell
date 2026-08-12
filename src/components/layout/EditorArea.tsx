import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { sshQuickConnect, sshDisconnect } from '@/services/sshService';
import { getHost, getKey } from '@/services/dataStore';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { ConnectConfig } from '@/contexts/TerminalTabsContext';
import { Terminal as TerminalComp } from '@/components/terminal';
import { useDragResize } from '@/hooks/use-drag-resize';
import { WelcomePage } from '@/pages/WelcomePage';
import { TabBar } from '@/components/tabbar';
import { SftpBottomPanel } from '@/components/sftp';
import { useNotify } from '@/hooks/use-notify';
import { getSshDefaults, getProxyConfig } from '@/services/configService';
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
  const { notify, notifyError } = useNotify();
  const prevSftpOpen = useRef(sftpOpen);
  const connectedTabs = useRef(new Set<string>());
  const abortRef = useRef(new Map<string, AbortController>());
  const [bottomHeight, setBottomHeight] = useStorage(STORAGE_KEYS.SFTP_HEIGHT, BOTTOM_PANEL_DEFAULT_HEIGHT);

  const { handleMouseDown: handleResizeStart } = useDragResize({
    axis: 'y',
    minSize: BOTTOM_PANEL_MIN_HEIGHT,
    maxSize: window.innerHeight * 0.6,
    defaultSize: bottomHeight,
    onSizeChange: setBottomHeight,
  });

  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Flag to prevent operations after component unmount
  const isMountedRef = useRef(true);
  // 已由“新增标签自动连接”effect 发起过连接的标签，避免新增其他标签时
  // 误重连旧的 disconnected 标签。
  const autoConnectStartedRef = useRef(new Set<string>());

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
        const [defaults, proxy] = await Promise.all([getSshDefaults(), getProxyConfig()]);
        reconnectConfig.current = {
          enabled: defaults.reconnectEnabled,
          maxRetries: defaults.reconnectMaxRetries,
          initialDelaySecs: defaults.reconnectInitialDelay,
          maxDelaySecs: defaults.reconnectMaxDelay,
        };
        if (controller.signal.aborted) return;

        // 组装连接参数：已保存主机从前端 store 读取最新主机+密钥，快速连接直接用表单参数
        const tab = tabsRef.current.find((t) => t.id === tabId);
        const hostId = tab?.type === 'terminal' ? tab.host?.id : undefined;

        let { hostname, port, username, password, privateKeyPath } = config;
        if (hostId) {
          const host = await getHost(hostId);
          if (host) {
            hostname = host.hostname;
            port = host.port;
            username = host.username;
            if (host.auth_method === 'key') {
              const key = host.key_id ? await getKey(host.key_id) : undefined;
              privateKeyPath = key?.content ?? null;
              password = key?.password ?? null;
            } else {
              password = host.password || null;
              privateKeyPath = null;
            }
          }
        }

        const result = await sshQuickConnect({
          tabId,
          hostname,
          port,
          username,
          password,
          privateKeyPath,
          monitorIntervalSecs: defaults.monitorInterval,
          heartbeatIntervalSecs: defaults.heartbeatInterval,
          idleTimeoutSecs: defaults.idleTimeout,
          proxy,
        });
        if (controller.signal.aborted) return;
        updateStatus(tabId, 'connected');
        retryCount.current.delete(tabId);
        // 提示实际连接通道：走代理时明确告知代理地址，直连时提示直连
        if (result?.via_proxy) {
          notify(t('connection.viaProxy', { proxy: result.via_proxy }));
        } else {
          notify(t('connection.viaDirect'));
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        notifyError(e);
        updateStatus(tabId, 'disconnected');
      } finally {
        connectedTabs.current.delete(tabId);
        abortRef.current.delete(tabId);
      }
    },
    [updateStatus, notify, notifyError, t],
  );

  useEffect(() => {
    const tabIds = new Set(tabs.map((t) => t.id));
    for (const id of autoConnectStartedRef.current) {
      if (!tabIds.has(id)) autoConnectStartedRef.current.delete(id);
    }
    for (const id of connectedTabs.current) {
      if (!tabIds.has(id)) connectedTabs.current.delete(id);
    }
    for (const tab of tabs) {
      if (tab.type !== 'terminal') continue;
      // 只自动连接“本次新增”的标签，已尝试过自动连接的标签（含连接失败
      // 后停留在 disconnected 的）不再由无关的新增标签操作触发重连。
      if (autoConnectStartedRef.current.has(tab.id)) continue;
      if (tab.status !== 'disconnected' || connectedTabs.current.has(tab.id)) continue;
      autoConnectStartedRef.current.add(tab.id);
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
        const msg = `${ANSI_NEWLINE}${ANSI_YELLOW}${delaySecs}${t('common.second')} ${t('terminal.reconnectRetry', { retry: nextRetry, max: cfg.maxRetries })}${ANSI_RESET}${ANSI_NEWLINE}`;
        writeToTerminal(tab_id, msg);

        const timer = setTimeout(() => {
          // Check if component is still mounted before attempting reconnection
          if (!isMountedRef.current) {
            return;
          }
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
      // Mark component as unmounted to prevent async operations
      isMountedRef.current = false;

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
