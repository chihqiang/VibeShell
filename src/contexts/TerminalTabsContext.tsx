import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { sshDisconnect } from '@/api/ssh';
import type { HostConfig } from '@/api/hosts';
import { useNotify } from '@/hooks/use-notify';
import ConfirmDialog from '@/components/sftp/dialogs/ConfirmDialog';

export type TabType = 'quick' | 'terminal';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ConnectConfig {
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key_path: string | null;
}

export interface TerminalTab {
  id: string;
  type: TabType;
  host?: HostConfig;
  status: ConnectionStatus;
  title: string;
  connectConfig?: ConnectConfig;
}

interface TerminalTabsContextValue {
  tabs: TerminalTab[];
  activeTabId: string | null;
  terminalTabVersion: number;
  addQuickTab: () => string;
  addTerminalTab: (config: ConnectConfig, host?: HostConfig) => string;
  convertTabToTerminal: (tabId: string, config: ConnectConfig, host?: HostConfig) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateStatus: (tabId: string, status: ConnectionStatus) => void;
}

const TerminalTabsContext = createContext<TerminalTabsContextValue | null>(null);

function createInitialTab(): TerminalTab {
  return {
    id: crypto.randomUUID(),
    type: 'quick',
    status: 'disconnected',
    title: 'Quick Connect',
  };
}

function createInitialState() {
  const tab = createInitialTab();
  return { tabs: [tab], activeTabId: tab.id };
}

export function TerminalTabsProvider({ children }: { children: ReactNode }) {
  const [{ tabs: initialTabs, activeTabId: initialActiveTabId }] = useState(createInitialState);
  const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(initialActiveTabId);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const { notifyError } = useNotify();
  const { t } = useTranslation();
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  const [terminalTabVersion, setTerminalTabVersion] = useState(0);

  const performClose = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab?.status === 'connected') {
        sshDisconnect({ tabId: tab.id }).catch((e) => notifyError(e));
      }

      if (tabsRef.current.length <= 1) {
        const newTab = createInitialTab();
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        return;
      }

      setTabs((prev) => prev.filter((t) => t.id !== tabId));

      if (activeTabIdRef.current === tabId) {
        const remaining = tabsRef.current.filter((t) => t.id !== tabId);
        const idx = tabsRef.current.findIndex((t) => t.id === tabId);
        const newIdx = Math.min(idx, remaining.length - 1);
        setActiveTabId(remaining[Math.max(0, newIdx)]?.id ?? remaining[0]?.id ?? null);
      }
    },
    [notifyError],
  );

  const confirmCloseTab = useCallback(() => {
    if (pendingCloseTabId) {
      performClose(pendingCloseTabId);
      setPendingCloseTabId(null);
    }
  }, [pendingCloseTabId, performClose]);

  const addQuickTab = useCallback(() => {
    const id = crypto.randomUUID();
    setTabs((prev) => [...prev, { id, type: 'quick', status: 'disconnected', title: 'Quick Connect' }]);
    setActiveTabId(id);
    return id;
  }, []);

  const addTerminalTab = useCallback((config: ConnectConfig, host?: HostConfig) => {
    const id = crypto.randomUUID();
    const title = host?.name || host?.hostname || config.hostname;
    setTabs((prev) => [
      ...prev,
      {
        id,
        type: 'terminal',
        host,
        status: 'disconnected',
        title,
        connectConfig: config,
      },
    ]);
    setActiveTabId(id);
    setTerminalTabVersion((v) => v + 1);
    return id;
  }, []);

  const convertTabToTerminal = useCallback((tabId: string, config: ConnectConfig, host?: HostConfig) => {
    const title = host?.name || host?.hostname || config.hostname;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              type: 'terminal' as const,
              host,
              title,
              status: 'disconnected',
              connectConfig: config,
            }
          : t,
      ),
    );
    setActiveTabId(tabId);
    setTerminalTabVersion((v) => v + 1);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab?.status === 'connected') {
        setPendingCloseTabId(tabId);
      } else {
        performClose(tabId);
      }
    },
    [performClose],
  );

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const updateStatus = useCallback((tabId: string, status: ConnectionStatus) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, status } : t)));
  }, []);

  const contextValue = {
    tabs,
    activeTabId,
    terminalTabVersion,
    addQuickTab,
    addTerminalTab,
    convertTabToTerminal,
    closeTab,
    setActiveTab,
    updateStatus,
  };

  return (
    <>
      <TerminalTabsContext.Provider value={contextValue}>{children}</TerminalTabsContext.Provider>
      <ConfirmDialog
        open={!!pendingCloseTabId}
        onOpenChange={(v) => {
          if (!v) setPendingCloseTabId(null);
        }}
        title={t('tab.closeConfirmTitle')}
        message={t('tab.closeConfirmMessage')}
        onConfirm={confirmCloseTab}
        variant="destructive"
      />
    </>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTerminalTabs() {
  const ctx = useContext(TerminalTabsContext);
  if (!ctx) throw new Error('useTerminalTabs must be used within TerminalTabsProvider');
  return ctx;
}
