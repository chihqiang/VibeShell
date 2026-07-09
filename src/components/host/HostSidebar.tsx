import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Server,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Terminal,
  Loader2,
  PanelRightClose,
  KeyRound,
  Settings,
  X,
  Copy,
} from 'lucide-react';
import { cn, hostToConnectConfig, buildSshCommand } from '@/lib/utils';
import { useStorage } from '@/lib/storage';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import { listHosts, listTags, deleteHost, saveHost } from '@/apis/api/hosts';
import { listKeys } from '@/apis/api/keys';
import { sshTestConnect } from '@/apis/api/ssh';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import HostDialog from '@/components/host/dialogs/HostDialog';
import DeleteHostDialog from '@/components/host/dialogs/DeleteHostDialog';
import KeyManagementDialog from '@/components/keys/dialogs/KeyManagementDialog';
import {
  COLLAPSED_WIDTH,
  MIN_WIDTH,
  MAX_WIDTH,
  STORAGE_KEY_COLLAPSED,
  STORAGE_KEY_WIDTH,
} from '@/lib/types';

export default function HostSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tabs, addTerminalTab } = useTerminalTabs();
  const { notify, notifyError } = useNotify();

  const [collapsed, setCollapsed] = useStorage(STORAGE_KEY_COLLAPSED, false);
  const [storedWidth, setStoredWidth] = useStorage(STORAGE_KEY_WIDTH, 240);
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, storedWidth));
  const setWidth = useCallback(
    (w: number) => setStoredWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))),
    [setStoredWidth],
  );

  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);
  const [keyMgmtOpen, setKeyMgmtOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const connectingRef = useRef(false);

  // Drag resize — RAF throttled to avoid jank
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const dragRafRef = useRef<number | null>(null);
  const dragWidthRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      setIsDragging(true);
      startX.current = e.clientX;
      startWidth.current = width;
      dragWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startWidth.current + e.clientX - startX.current),
      );
      dragWidthRef.current = newWidth;
      // RAF throttle: at most one state update per frame
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          setWidth(dragWidthRef.current);
        });
      }
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      // Cancel pending RAF, persist final value once
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setWidth(dragWidthRef.current);
      setIsDragging(false);
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
  }, [setWidth]);

  const loadData = useCallback(async () => {
    try {
      const [h, tg, k] = await Promise.all([listHosts(), listTags(), listKeys()]);
      setHosts(h);
      setTags(tg);
      setKeys(k);
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-expand the first tag group on initial load
  useEffect(() => {
    if (autoExpanded || tags.length === 0 || hosts.length === 0) return;
    const firstTagWithHosts = tags.find((t) => hosts.some((h) => h.tags?.includes(t)));
    if (firstTagWithHosts) {
      setExpandedTags((prev) => new Set(prev).add(firstTagWithHosts));
    }
    setAutoExpanded(true);
  }, [tags, hosts, autoExpanded]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick() {
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

  const taggedSections = useMemo(
    () =>
      tags
        .map((t) => ({ tag: t, hosts: filtered.filter((h) => h.tags?.includes(t)) }))
        .filter((s) => s.hosts.length > 0),
    [filtered, tags],
  );

  const ungrouped = useMemo(() => filtered.filter((h) => !h.tags || h.tags.length === 0), [filtered]);
  const hasContent = taggedSections.length > 0 || ungrouped.length > 0;

  function toggleTag(tag: string) {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function openAddDialog() {
    setEditingHost(null);
    setDialogOpen(true);
  }

  function openEditDialog(host: HostConfig) {
    setMenuOpenId(null);
    setEditingHost(host);
    setDialogOpen(true);
  }

  const handleMenuToggle = useCallback((host: HostConfig) => {
    setMenuOpenId((prev) => (prev === host.id ? null : host.id));
  }, []);

  const handleDelete = useCallback((host: HostConfig) => {
    setMenuOpenId(null);
    setConfirmDeleteId(host.id);
  }, []);

  const handleCopySsh = useCallback(
    (host: HostConfig) => {
      const cmd = buildSshCommand({
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        password: host.password ?? null,
        privateKeyPath: host.private_key_path ?? null,
      });
      navigator.clipboard.writeText(cmd).then(() => notify(t('common.copied')));
      setMenuOpenId(null);
    },
    [notify, t],
  );

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingHost(null);
    loadData();
  }

  async function openTerminal(host: HostConfig) {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnectingId(host.id);
    setMenuOpenId(null);
    try {
      const config = await hostToConnectConfig(host, keys);
      await sshTestConnect(config);
      addTerminalTab(config, host);
      const now = Date.now();
      await saveHost({ host: { ...host, last_connected_at: now } });
      setHosts((prev) => prev.map((h) => (h.id === host.id ? { ...h, last_connected_at: now } : h)));
      navigate('/');
    } catch (e) {
      notifyError(e);
    } finally {
      setConnectingId(null);
      connectingRef.current = false;
    }
  }

  const openTerminalCb = useCallback((host: HostConfig) => { openTerminal(host); }, [keys, addTerminalTab, navigate, notifyError]);

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    try {
      await deleteHost({ id: confirmDeleteId });
      setHosts((prev) => prev.filter((h) => h.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      notifyError(e);
      setConfirmDeleteId(null);
    }
  }

  function handleDeleteTag(tag: string) {
    setConfirmDeleteTag(tag);
  }

  async function doConfirmDeleteTag() {
    const tag = confirmDeleteTag;
    if (!tag) return;
    try {
      const affected = hosts.filter((h) => h.tags?.includes(tag));
      await Promise.all(
        affected.map((h) =>
          saveHost({ host: { ...h, tags: h.tags ? h.tags.filter((t) => t !== tag) : [] } }),
        ),
      );
      setTags((prev) => prev.filter((t) => t !== tag));
      setHosts((prev) =>
        prev.map((h) => ({
          ...h,
          tags: h.tags ? h.tags.filter((t) => t !== tag) : [],
        })),
      );
    } catch (e) {
      notifyError(e);
    } finally {
      setConfirmDeleteTag(null);
    }
  }

  const toggle = () => setCollapsed(!collapsed);

  // Collapsed view
  if (collapsed) {
    return (
      <aside
        className="bg-secondary border-r border-border/60 flex-shrink-0 flex flex-col items-center pt-3 gap-2 relative"
        style={{ width: COLLAPSED_WIDTH }}
      >
        <button
          onClick={toggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t('sidebar.hostManagement')}
        >
          <Server size={16} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setKeyMgmtOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t('sidebar.keyManagement')}
        >
          <KeyRound size={16} />
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer mb-3"
          title={t('settings.title')}
        >
          <Settings size={16} />
        </button>

        <KeyManagementDialog open={keyMgmtOpen} onClose={() => setKeyMgmtOpen(false)} />
      </aside>
    );
  }

  // Expanded view
  return (
    <aside
      className={cn(
        'bg-secondary border-r border-border/60 flex-shrink-0 flex flex-col relative overflow-hidden',
        isDragging ? '' : 'transition-[width] duration-200',
      )}
      style={{ width }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {t('sidebar.hostManagement')}
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggle}
            className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={t('common.collapse')}
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>

      {/* Search + Add */}
      <div className="px-2.5 py-2 border-b border-border/60 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.search')}
            className="h-7 pl-8 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <Button variant="outline" size="icon-sm" className="flex-shrink-0" onClick={openAddDialog} title={t('sidebar.addHost')}>
          <Plus size={14} />
        </Button>
      </div>

      {/* Host list */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {taggedSections.map(({ tag, hosts: th }) => {
          const expanded = expandedTags.has(tag) || !!searchQuery;
          return (
            <div key={tag} className="mb-0.5">
              <button
                onClick={() => toggleTag(tag)}
                className="group flex items-center gap-1.5 w-full h-7 px-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate flex-1">
                  {tag}
                </span>
                <Badge variant="ghost" className="h-4 px-1.5 text-[10px]">
                  {th.length}
                </Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </button>
              {expanded && (
                <div>
                  {th.map((h) => (
                    <HostTreeItem
                      key={h.id}
                      host={h}
                      connected={connectedHostIds.has(h.id)}
                      connecting={connectingId === h.id}
                      menuOpen={menuOpenId === h.id}
                      onMenuToggle={handleMenuToggle}
                      onOpenTerminal={openTerminalCb}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      onCopySsh={handleCopySsh}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="mb-0.5">
            {(taggedSections.length > 0 || searchQuery) && (
              <div className="flex items-center gap-1.5 w-full h-7 px-3">
                <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('sidebar.noTag')}
                </span>
                <Badge variant="ghost" className="h-4 px-1.5 text-[10px]">
                  {ungrouped.length}
                </Badge>
              </div>
            )}
            {ungrouped.map((h) => (
              <HostTreeItem
                key={h.id}
                host={h}
                connected={connectedHostIds.has(h.id)}
                connecting={connectingId === h.id}
                menuOpen={menuOpenId === h.id}
                onMenuToggle={handleMenuToggle}
                onOpenTerminal={openTerminalCb}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onCopySsh={handleCopySsh}
              />
            ))}
          </div>
        )}

        {!hasContent && !searchQuery && (
          <div className="flex flex-col items-center gap-3 pt-12 px-4 text-muted-foreground">
            <Server size={28} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noHosts')}</span>
            <Button variant="outline" size="xs" className="gap-1.5" onClick={openAddDialog}>
              <Plus size={13} />
              {t('sidebar.addHost')}
            </Button>
            <button
              onClick={() => navigate('/')}
              className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer"
            >
              {t('quickConnect.title')} →
            </button>
          </div>
        )}

        {!hasContent && searchQuery && (
          <div className="flex flex-col items-center gap-2 pt-12 px-4 text-muted-foreground">
            <Search size={24} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noSearchResults', '未找到匹配的主机')}</span>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border/60 p-2 flex items-center gap-1">
        <button
          onClick={() => setKeyMgmtOpen(true)}
          className="flex items-center gap-2 flex-1 h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <KeyRound size={14} />
          {t('sidebar.keyManagement')}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t('settings.title')}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/60 transition-colors"
        onMouseDown={onMouseDown}
      >
        <div className="absolute top-1/2 right-0 w-[5px] h-8 -translate-y-1/2 rounded-full hover:bg-primary/40 transition-colors" />
      </div>

      <HostDialog open={dialogOpen} onClose={handleDialogClose} host={editingHost} tags={tags} keys={keys} />
      <DeleteHostDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
      <DeleteHostDialog
        open={confirmDeleteTag !== null}
        onClose={() => setConfirmDeleteTag(null)}
        onConfirm={doConfirmDeleteTag}
      />
      <KeyManagementDialog open={keyMgmtOpen} onClose={() => setKeyMgmtOpen(false)} />
    </aside>
  );
}

// --- Host tree item ---

const HostTreeItem = memo(function HostTreeItem({
  host,
  connected,
  connecting,
  menuOpen,
  onMenuToggle,
  onOpenTerminal,
  onEdit,
  onDelete,
  onCopySsh,
}: {
  host: HostConfig;
  connected: boolean;
  connecting: boolean;
  menuOpen: boolean;
  onMenuToggle: (host: HostConfig) => void;
  onOpenTerminal: (host: HostConfig) => void;
  onEdit: (host: HostConfig) => void;
  onDelete: (host: HostConfig) => void;
  onCopySsh: (host: HostConfig) => void;
}) {
  const { t } = useTranslation();
  const menuPosRef = useRef({ x: 0, y: 0 });

  const statusColor = connected
    ? 'bg-green-500'
    : connecting
      ? 'bg-yellow-500'
      : 'bg-muted-foreground/30';

  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-9 pl-7 pr-2 transition-all relative',
        connecting ? 'opacity-60 pointer-events-none' : 'hover:bg-muted cursor-pointer',
        menuOpen && 'bg-muted',
      )}
      onClick={() => !connecting && onOpenTerminal(host)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        menuPosRef.current = { x: e.clientX, y: e.clientY };
        onMenuToggle(host);
      }}
    >
      {/* Hover indicator bar */}
      <div className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-r-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      {connecting ? (
        <Loader2 size={12} className="animate-spin text-primary flex-shrink-0" />
      ) : (
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125', statusColor)} />
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-xs text-foreground truncate leading-tight">{host.name}</span>
        <span className="text-[10px] text-muted-foreground/70 truncate leading-tight font-mono">
          {host.username}@{host.hostname}:{host.port}
        </span>
      </div>

      <div className="relative flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle(host);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer rounded"
        >
          <Terminal size={12} />
        </button>

        {menuOpen && (
          <div
            className="fixed z-50 w-40 rounded-lg border border-border bg-popover shadow-lg py-1"
            style={{ left: menuPosRef.current.x, top: menuPosRef.current.y }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !connecting && onOpenTerminal(host)}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Terminal size={13} />
              {t('connection.openTerminal')}
            </button>
            <button
              onClick={() => onEdit(host)}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil size={13} />
              {t('connection.edit')}
            </button>
            <button
              onClick={() => onCopySsh(host)}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Copy size={13} />
              {t('tab.copyHostInfo', '复制主机信息')}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button
              onClick={() => onDelete(host)}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left text-destructive hover:bg-muted transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t('connection.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
