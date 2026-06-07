import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
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
  tabs: TerminalTab[];
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
  return { tabs: [tab], activeTabId: tab.id, pendingCloseTabId: null, terminalTabVersion: 0 };
}

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'ADD_QUICK_TAB':
      return {
        ...state,
        tabs: [
          ...state.tabs,
          { id: action.id, type: 'quick' as const, status: 'disconnected' as const, title: 'Quick Connect' },
        ],
        activeTabId: action.id,
      };

    case 'ADD_TERMINAL_TAB': {
      const title = action.host?.name || action.host?.hostname || action.config.hostname;
      return {
        ...state,
        tabs: [
          ...state.tabs,
          {
            id: action.id,
            type: 'terminal' as const,
            host: action.host,
            status: 'disconnected' as const,
            title,
            connectConfig: action.config,
          },
        ],
        activeTabId: action.id,
        terminalTabVersion: state.terminalTabVersion + 1,
      };
    }

    case 'CONVERT_TO_TERMINAL': {
      const title = action.host?.name || action.host?.hostname || action.config.hostname;
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId
            ? {
                id: t.id,
                type: 'terminal' as const,
                host: action.host,
                status: 'disconnected' as const,
                title,
                connectConfig: action.config,
              }
            : t,
        ),
        activeTabId: action.tabId,
        terminalTabVersion: state.terminalTabVersion + 1,
      };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.tabId };

    case 'UPDATE_STATUS':
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.id === action.tabId ? { ...t, status: action.status } : t)),
      };

    case 'SET_PENDING_CLOSE':
      return { ...state, pendingCloseTabId: action.tabId };

    case 'REPLACE_ALL':
      return { ...state, tabs: action.tabs, activeTabId: action.activeTabId };

    case 'REMOVE_TAB': {
      const remaining = state.tabs.filter((t) => t.id !== action.tabId);
      let nextActiveTabId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        const idx = state.tabs.findIndex((t) => t.id === action.tabId);
        const newIdx = Math.min(idx, remaining.length - 1);
        nextActiveTabId = remaining[Math.max(0, newIdx)]?.id ?? null;
      }
      return { ...state, tabs: remaining, activeTabId: nextActiveTabId };
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

  const performClose = useCallback((tabId: string) => {
    const s = stateRef.current;
    const tab = s.tabs.find((t) => t.id === tabId);
    if (tab?.type === 'terminal') {
      sshDisconnect({ tabId: tab.id }).catch(() => {});
    }

    if (s.tabs.length <= 1) {
      const newTab = createInitialTab();
      dispatch({ type: 'REPLACE_ALL', tabs: [newTab], activeTabId: newTab.id });
      return;
    }

    dispatch({ type: 'REMOVE_TAB', tabId });
  }, []);

  const confirmCloseTab = useCallback(() => {
    const tabId = stateRef.current.pendingCloseTabId;
    if (tabId) {
      performClose(tabId);
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
      const tab = stateRef.current.tabs.find((t) => t.id === tabId);
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

  const updateStatus = useCallback((tabId: string, status: ConnectionStatus) => {
    dispatch({ type: 'UPDATE_STATUS', tabId, status });
  }, []);

  const contextValue: TerminalTabsContextValue = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    terminalTabVersion: state.terminalTabVersion,
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
