import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Square, Search, Server, Loader2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { cn, hostToConnectConfig } from '@/utils';
import { DOM_EVENTS } from '@/constants';
import { listHosts, saveHost } from '@/services/hostService';
import { listKeys } from '@/services/keyService';
import { sshTestConnect } from '@/services/sshService';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useNotify } from '@/hooks/use-notify';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';

const appWindow = getCurrentWindow();

/** 窗口控制按钮（红黄绿三色圆点） */
function WindowControls() {
  const { t } = useTranslation();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5 pl-3 pr-2">
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none group"
          onClick={() => setCloseConfirmOpen(true)}
          title={t('topbar.close')}
        >
          <X size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none group"
          onClick={() => appWindow.minimize()}
          title={t('topbar.minimize')}
        >
          <Minus size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          className="flex items-center justify-center w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none group"
          onClick={() => appWindow.toggleMaximize()}
          title={t('topbar.maximize')}
        >
          <Square size={9} className="text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title={t('common.quit')}
        message={t('common.quitConfirm')}
        onConfirm={() => appWindow.close()}
        variant="destructive"
      />
    </>
  );
}

/** 顶部搜索栏 — 快速搜索主机并连接 */
function GlobalSearch() {
  const { t } = useTranslation();
  const { tabs, addTerminalTab, setActiveTab } = useTerminalTabs();
  const { setActiveView } = useLayout();
  const { notifyError } = useNotify();

  const [query, setQuery] = useState('');
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connectingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reload = () =>
      Promise.all([listHosts(), listKeys()])
        .then(([h, k]) => {
          setHosts(h);
          setKeys(k);
        })
        .catch(notifyError);
    reload();
    window.addEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
    return () => window.removeEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
  }, [notifyError]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? hosts.filter(
        (h) =>
          h.name.toLowerCase().includes(query.toLowerCase()) ||
          h.hostname.toLowerCase().includes(query.toLowerCase()) ||
          h.username.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  const connectHost = useCallback(
    async (host: HostConfig) => {
      const existingTab = tabs.find((t) => t.type === 'terminal' && t.host?.id === host.id);
      if (existingTab) {
        setActiveTab(existingTab.id);
        setActiveView(null);
        setQuery('');
        setOpen(false);
        return;
      }

      if (connectingRef.current) return;
      connectingRef.current = true;
      setConnectingId(host.id);
      try {
        const config = await hostToConnectConfig(host, keys);
        await sshTestConnect(config);
        addTerminalTab(config, host);
        const now = Date.now();
        await saveHost({ host: { ...host, last_connected_at: now } });
        setHosts((prev) => prev.map((h) => (h.id === host.id ? { ...h, last_connected_at: now } : h)));
        window.dispatchEvent(new CustomEvent(DOM_EVENTS.HOSTS_CHANGED));
        setQuery('');
        setOpen(false);
        setActiveView(null);
      } catch (e) {
        notifyError(e);
      } finally {
        setConnectingId(null);
        connectingRef.current = false;
      }
    },
    [tabs, keys, addTerminalTab, setActiveTab, setActiveView, notifyError],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusIdx >= 0 && filtered[focusIdx]) {
      e.preventDefault();
      connectHost(filtered[focusIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setFocusIdx(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <Search
        size={13}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <Input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setFocusIdx(-1);
        }}
        onFocus={() => query && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('topbar.searchPlaceholder')}
        className="h-6 pl-8 pr-3 text-xs bg-muted/50 border-none"
      />

      {open && query && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover/90 backdrop-blur-md shadow-xl">
          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Search size={13} className="opacity-40" />
              {t('sidebar.noSearchResults')}
            </div>
          ) : (
            filtered.map((host, i) => (
              <button
                key={host.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  connectHost(host);
                }}
                onMouseEnter={() => setFocusIdx(i)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 cursor-pointer',
                  i === focusIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/80',
                )}
              >
                <Server size={13} className="flex-shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{host.name}</div>
                  <div className="text-[10px] text-muted-foreground/70 truncate font-mono">
                    {host.username}@{host.hostname}:{host.port}
                  </div>
                </div>
                {connectingId === host.id && <Loader2 size={12} className="animate-spin flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** 顶部导航栏 — 窗口控制 + 搜索栏 */
export function TopBar() {
  return (
    <div className="flex items-center w-full h-full">
      <WindowControls />
      <div className="flex-1 h-full flex items-center px-3 gap-2" data-tauri-drag-region>
        <div className="flex-1 flex items-center" data-tauri-drag-region>
          <GlobalSearch />
        </div>
      </div>
    </div>
  );
}
