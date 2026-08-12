import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, Server, Terminal, Pencil, MoreVertical, Copy } from 'lucide-react';
import { cn, buildSshCommand } from '@/utils';
import { copyText } from '@/utils/clipboard';
import { DOM_EVENTS } from '@/constants';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useNotify } from '@/hooks/use-notify';
import { listHosts, deleteHost, saveHost } from '@/services/hostService';
import { listKeys } from '@/services/keyService';

import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HostDialog } from '@/components/host';
import { DeleteDialog } from '@/components/ui';
import { PanelHeader } from '@/components/layout/SidePanel';

/** 主机管理侧边栏面板 */
export function HostSidePanel() {
  const { t } = useTranslation();
  const { tabs, addTerminalTab, setActiveTab } = useTerminalTabs();
  const { setActiveView } = useLayout();
  const { notify, notifyError } = useNotify();

  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const connectingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [h, k] = await Promise.all([listHosts(), listKeys()]);
      setHosts(h);
      setKeys(k);
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.HOSTS_CHANGED));
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      // 点击在菜单内部时不关闭 — 由按钮 onClick 自行处理
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setMenuOpenId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  const connectedHostIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tab of tabs) {
      if (tab.type === 'terminal' && tab.host?.id) {
        ids.add(tab.host.id);
      }
    }
    return ids;
  }, [tabs]);

  const filtered = useMemo(
    () =>
      hosts.filter(
        (h) =>
          h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.hostname.includes(searchQuery) ||
          h.username.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [hosts, searchQuery],
  );

  const hasContent = filtered.length > 0;

  function openAddDialog() {
    setEditingHost(null);
    setDialogOpen(true);
  }

  function openEditDialog(host: HostConfig) {
    setMenuOpenId(null);
    setEditingHost(host);
    setDialogOpen(true);
  }

  function handleDelete(host: HostConfig) {
    setMenuOpenId(null);
    setConfirmDeleteId(host.id);
  }

  function handleCopySsh(host: HostConfig) {
    const cmd = buildSshCommand({
      hostname: host.hostname,
      port: host.port,
      username: host.username,
      password: host.password ?? null,
      privateKeyPath: host.key_id ?? null,
    });
    copyText(cmd).then(() => notify(t('common.copied')));
    setMenuOpenId(null);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingHost(null);
    loadData();
  }

  async function openTerminal(host: HostConfig) {
    const existingTab = tabs.find((t) => t.type === 'terminal' && t.host?.id === host.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      setActiveView(null);
      return;
    }

    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnectingId(host.id);
    setMenuOpenId(null);
    try {
      // 使用 hostId 创建 ConnectConfig，EditorArea 将根据 hostId 调用新的 sshConnect API
      const config: import('@/types/host').ConnectConfig = {
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        password: host.password || null,
        privateKeyPath: host.key_id || null,
      };
      addTerminalTab(config, host);
      const now = Date.now();
      await saveHost({ host: { ...host, last_connected_at: now } });
      setHosts((prev) => prev.map((h) => (h.id === host.id ? { ...h, last_connected_at: now } : h)));
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.HOSTS_CHANGED));
      setActiveView(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setConnectingId(null);
      connectingRef.current = false;
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    try {
      await deleteHost({ id: confirmDeleteId });
      notify(t('connection.hostDeleted'));
      setHosts((prev) => prev.filter((h) => h.id !== confirmDeleteId));
      setConfirmDeleteId(null);
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.HOSTS_CHANGED));
    } catch (e) {
      notifyError(e);
      setConfirmDeleteId(null);
    }
  }

  function renderHostRow(host: HostConfig) {
    const connected = connectedHostIds.has(host.id);
    const connecting = connectingId === host.id;
    return (
      <div
        key={host.id}
        className="group flex items-center gap-2 h-8 px-3 cursor-pointer hover:bg-muted/70 hover:shadow-sm transition-all duration-150 relative"
        onClick={() => openTerminal(host)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpenId(host.id);
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded shrink-0',
            connected ? 'bg-green-500/15' : 'bg-muted',
          )}
        >
          <Server size={11} className={cn(connected ? 'text-green-500' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-foreground truncate">{host.name}</span>
            {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground/70 truncate block font-mono">
            {host.username}@{host.hostname}
          </span>
        </div>
        {connecting && (
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(menuOpenId === host.id ? null : host.id);
          }}
          className="p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <MoreVertical size={13} />
        </button>

        {menuOpenId === host.id && (
          <div
            ref={menuRef}
            className="absolute right-2 top-8 z-50 w-32 bg-popover/90 backdrop-blur-md border border-border rounded-lg shadow-xl py-0.5"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                openTerminal(host);
              }}
              className="flex items-center gap-2 w-full h-7 px-2.5 text-xs text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
            >
              <Terminal size={12} /> {t('connection.openTerminal')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(host);
              }}
              className="flex items-center gap-2 w-full h-7 px-2.5 text-xs text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
            >
              <Pencil size={12} /> {t('connection.edit')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopySsh(host);
              }}
              className="flex items-center gap-2 w-full h-7 px-2.5 text-xs text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
            >
              <Copy size={12} /> {t('common.copySshCommand')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(host);
              }}
              className="flex items-center gap-2 w-full h-7 px-2.5 text-xs text-destructive hover:bg-destructive/5 transition-all duration-150 cursor-pointer"
            >
              <Trash2 size={12} /> {t('connection.delete')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PanelHeader title={t('sidebar.hostManagement')} onClose={() => setActiveView(null)} />

      <div className="px-2.5 py-2 border-b border-border/60 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.search')}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          onClick={openAddDialog}
          title={t('sidebar.addHost')}
        >
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filtered.map(renderHostRow)}

        {!hasContent && !searchQuery && (
          <div className="flex flex-col items-center gap-3 pt-12 px-4 text-muted-foreground">
            <Server size={28} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noHosts')}</span>
            <Button variant="outline" size="xs" className="gap-1.5" onClick={openAddDialog}>
              <Plus size={13} />
              {t('sidebar.addHost')}
            </Button>
          </div>
        )}

        {!hasContent && searchQuery && (
          <div className="flex flex-col items-center gap-2 pt-12 px-4 text-muted-foreground">
            <Search size={24} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noSearchResults')}</span>
          </div>
        )}
      </div>

      <HostDialog open={dialogOpen} onClose={handleDialogClose} host={editingHost} keys={keys} />
      <DeleteDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        titleKey="sidebar.confirmDeleteHost"
      />
    </>
  );
}
