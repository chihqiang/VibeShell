import { useState, useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import type { MonitorEvent } from '@/types/monitor';

// Module-level singleton: a single listener shared across all components
type ListenerEntry = {
  tabId: string;
  unlisten: UnlistenFn;
  refCount: number;
  callbacks: Set<(event: MonitorEvent) => void>;
};

let activeEntry: ListenerEntry | null = null;

function acquire(tabId: string, cb: (event: MonitorEvent) => void): () => void {
  if (activeEntry && activeEntry.tabId === tabId) {
    activeEntry.refCount++;
    activeEntry.callbacks.add(cb);
    return () => release(cb);
  }

  // If a different tabId is active, tear it down first
  if (activeEntry) {
    activeEntry.unlisten();
    activeEntry = null;
  }

  const callbacks = new Set<(event: MonitorEvent) => void>();
  callbacks.add(cb);

  const entry: ListenerEntry = { tabId, unlisten: () => {}, refCount: 1, callbacks };
  activeEntry = entry;

  listen<MonitorEvent>('ssh://monitor', (event) => {
    if (event.payload.tab_id !== entry.tabId) return;
    for (const fn of entry.callbacks) fn(event.payload);
  }).then((unlisten) => {
    if (entry !== activeEntry) {
      unlisten();
      return;
    }
    entry.unlisten = unlisten;
  });

  return () => release(cb);
}

function release(cb: (event: MonitorEvent) => void) {
  if (!activeEntry) return;
  activeEntry.callbacks.delete(cb);
  activeEntry.refCount--;
  if (activeEntry.refCount <= 0) {
    activeEntry.unlisten();
    activeEntry = null;
  }
}

/**
 * Shared monitor listener — registers a single `ssh://monitor` listener
 * for the active connected terminal tab, regardless of how many components
 * call this hook.
 */
export function useMonitorData(): MonitorEvent | null {
  const { tabs, activeTabId } = useTerminalTabs();
  const { notifyError } = useNotify();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabId = activeTab?.type === 'terminal' && activeTab.status === 'connected' ? activeTab.id : null;

  const [data, setData] = useState<MonitorEvent | null>(null);
  const dataRef = useRef<MonitorEvent | null>(null);

  useEffect(() => {
    // Only clear data when there's no connected terminal at all.
    // When switching between connected tabs, keep the old data visible
    // until new data arrives — avoids a jarring blank flash.
    if (!tabId) {
      dataRef.current = null;
      setData(null);
      return;
    }

    const cb = (event: MonitorEvent) => {
      dataRef.current = event;
      setData(event);
    };

    const dispose = acquire(tabId, cb);
    return dispose;
  }, [tabId, notifyError]);

  return data;
}
