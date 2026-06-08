import { createContext, useContext, useReducer, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { sshDisconnect } from '@/apis/api/ssh';
import type { HostConfig } from '@/apis/types/hosts';
import ConfirmDialog from '@/components/sftp/dialogs/ConfirmDialog';
import type { TabType, ConnectionStatus } from '@/lib/types';

export type { TabType, ConnectionStatus };

export interface ConnectConfig {
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key_path: string | null;
}

interface BaseTab {
  id: string;
  status: ConnectionStatus;
  title: string;
}

export interface QuickTab extends BaseTab {
  type: 'quick';
}

export interface TerminalTabData extends BaseTab {
  type: 'terminal';
  host?: HostConfig;
  connectConfig: ConnectConfig;
}

export type TerminalTab = QuickTab | TerminalTabData;

interface TerminalTabsContextValue {
  tabs: TerminalTab[];
  activeTabId: string | null;
  terminalTabVersion: number;
  addQuickTab: () => string;
  addTerminalTab: (config: ConnectConfig, host?: HostConfig) => string;
  convertTabToTerminal: (tabId: string, config: ConnectConfig, host?: HostConfig) => void;
  closeTab: (tabId: string) => void;
  closeAllOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  updateStatus: (tabId: string, status: ConnectionStatus) => void;
}

function createInitialTab(): QuickTab {
  return {
    id: crypto.randomUUID(),
    type: 'quick' as const,
    status: 'disconnected',
    title: 'Quick Connect',
  };
}

const TerminalTabsContext = createContext<TerminalTabsContextValue | null>(null);

interface TabsState {
  tabMap: Map<string, TerminalTab>;
  activeTabId: string | null;
  pendingCloseTabId: string | null;
  terminalTabVersion: number;
}

type TabsAction =
  | { type: 'ADD_QUICK_TAB'; id: string }
  | { type: 'ADD_TERMINAL_TAB'; id: string; config: ConnectConfig; host?: HostConfig }
  | { type: 'CONVERT_TO_TERMINAL'; tabId: string; config: ConnectConfig; host?: HostConfig }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'UPDATE_STATUS'; tabId: string; status: ConnectionStatus }
  | { type: 'SET_PENDING_CLOSE'; tabId: string | null }
  | { type: 'REPLACE_ALL'; tabs: TerminalTab[]; activeTabId: string }
  | { type: 'REMOVE_TAB'; tabId: string };

function createInitialState(): TabsState {
  const tab = createInitialTab();
  const tabMap = new Map<string, TerminalTab>();
  tabMap.set(tab.id, tab);
  return { tabMap, activeTabId: tab.id, pendingCloseTabId: null, terminalTabVersion: 0 };
}

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'ADD_QUICK_TAB': {
      const tab: TerminalTab = { id: action.id, type: 'quick', status: 'disconnected', title: 'Quick Connect' };
      const tabMap = new Map(state.tabMap);
      tabMap.set(action.id, tab);
      return { ...state, tabMap, activeTabId: action.id };
    }

    case 'ADD_TERMINAL_TAB': {
      const title = action.host?.name || action.host?.hostname || action.config.hostname;
      const tab: TerminalTab = {
        id: action.id,
        type: 'terminal',
        host: action.host,
        status: 'disconnected',
        title,
        connectConfig: action.config,
      };
      const tabMap = new Map(state.tabMap);
      tabMap.set(action.id, tab);
      return { ...state, tabMap, activeTabId: action.id, terminalTabVersion: state.terminalTabVersion + 1 };
    }

    case 'CONVERT_TO_TERMINAL': {
      const title = action.host?.name || action.host?.hostname || action.config.hostname;
      const tabMap = new Map(state.tabMap);
      const existing = tabMap.get(action.tabId);
      if (existing) {
        tabMap.set(action.tabId, {
          ...existing,
          type: 'terminal',
          host: action.host,
          status: 'disconnected',
          title,
          connectConfig: action.config,
        } as TerminalTab);
      }
      return { ...state, tabMap, activeTabId: action.tabId, terminalTabVersion: state.terminalTabVersion + 1 };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.tabId };

    case 'UPDATE_STATUS': {
      const tabMap = new Map(state.tabMap);
      const tab = tabMap.get(action.tabId);
      if (tab) {
        tabMap.set(action.tabId, { ...tab, status: action.status });
      }
      return { ...state, tabMap };
    }

    case 'SET_PENDING_CLOSE':
      return { ...state, pendingCloseTabId: action.tabId };

    case 'REPLACE_ALL': {
      const tabMap = new Map<string, TerminalTab>();
      for (const tab of action.tabs) {
        tabMap.set(tab.id, tab);
      }
      return { ...state, tabMap, activeTabId: action.activeTabId };
    }

    case 'REMOVE_TAB': {
      const tabMap = new Map(state.tabMap);
      tabMap.delete(action.tabId);
      let nextActiveTabId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        const ids = Array.from(tabMap.keys());
        if (ids.length === 0) {
          nextActiveTabId = null;
        } else {
          const prevIds = Array.from(state.tabMap.keys());
          const idx = prevIds.indexOf(action.tabId);
          const newIdx = Math.min(idx, ids.length - 1);
          nextActiveTabId = ids[Math.max(0, newIdx)];
        }
      }
      return { ...state, tabMap, activeTabId: nextActiveTabId };
    }

    default:
      return state;
  }
}

export function TerminalTabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { t } = useTranslation();

  const tabs = useMemo(() => Array.from(state.tabMap.values()), [state.tabMap]);

  const performClose = useCallback(async (tabId: string) => {
    const s = stateRef.current;
    const tab = s.tabMap.get(tabId);
    if (tab?.type === 'terminal') {
      try {
        await sshDisconnect({ tabId: tab.id });
      } catch {
        // ignore disconnect errors on close
      }
    }

    if (s.tabMap.size <= 1) {
      const newTab = createInitialTab();
      dispatch({ type: 'REPLACE_ALL', tabs: [newTab], activeTabId: newTab.id });
      return;
    }

    dispatch({ type: 'REMOVE_TAB', tabId });
  }, []);

  const confirmCloseTab = useCallback(async () => {
    const tabId = stateRef.current.pendingCloseTabId;
    if (tabId) {
      await performClose(tabId);
      dispatch({ type: 'SET_PENDING_CLOSE', tabId: null });
    }
  }, [performClose]);

  const addQuickTab = useCallback(() => {
    const id = crypto.randomUUID();
    dispatch({ type: 'ADD_QUICK_TAB', id });
    return id;
  }, []);

  const addTerminalTab = useCallback((config: ConnectConfig, host?: HostConfig) => {
    const id = crypto.randomUUID();
    dispatch({ type: 'ADD_TERMINAL_TAB', id, config, host });
    return id;
  }, []);

  const convertTabToTerminal = useCallback((tabId: string, config: ConnectConfig, host?: HostConfig) => {
    dispatch({ type: 'CONVERT_TO_TERMINAL', tabId, config, host });
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = stateRef.current.tabMap.get(tabId);
      if (tab?.status === 'connected') {
        dispatch({ type: 'SET_PENDING_CLOSE', tabId });
      } else {
        performClose(tabId);
      }
    },
    [performClose],
  );

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tabId });
  }, []);

  const closeAllTabs = useCallback(() => {
    const s = stateRef.current;
    for (const tab of s.tabMap.values()) {
      performClose(tab.id);
    }
  }, [performClose]);

  const closeAllOtherTabs = useCallback(
    (tabId: string) => {
      const s = stateRef.current;
      for (const tab of s.tabMap.values()) {
        if (tab.id !== tabId) {
          performClose(tab.id);
        }
      }
    },
    [performClose],
  );

  const updateStatus = useCallback((tabId: string, status: ConnectionStatus) => {
    dispatch({ type: 'UPDATE_STATUS', tabId, status });
  }, []);

  const contextValue = useMemo<TerminalTabsContextValue>(
    () => ({
      tabs,
      activeTabId: state.activeTabId,
      terminalTabVersion: state.terminalTabVersion,
      addQuickTab,
      addTerminalTab,
      convertTabToTerminal,
      closeTab,
      closeAllOtherTabs,
      closeAllTabs,
      setActiveTab,
      updateStatus,
    }),
    [
      tabs,
      state.activeTabId,
      state.terminalTabVersion,
      addQuickTab,
      addTerminalTab,
      convertTabToTerminal,
      closeTab,
      closeAllOtherTabs,
      closeAllTabs,
      setActiveTab,
      updateStatus,
    ],
  );

  return (
    <>
      <TerminalTabsContext.Provider value={contextValue}>{children}</TerminalTabsContext.Provider>
      <ConfirmDialog
        open={!!state.pendingCloseTabId}
        onOpenChange={(v) => {
          if (!v) dispatch({ type: 'SET_PENDING_CLOSE', tabId: null });
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
