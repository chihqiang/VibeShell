import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HostDialog from '@/components/host/dialogs/HostDialog';
import DeleteHostDialog from '@/components/host/dialogs/DeleteHostDialog';
import HostRow from '@/components/host/HostRow';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { useNotify } from '@/hooks/use-notify';
import { deleteHost, saveHost } from '@/apis/api/hosts';
import { sshTestConnect } from '@/apis/api/ssh';
import { fetchAllHostData } from '@/apis/utils/hosts';
import { hostToConnectConfig } from '@/lib/utils';

export default function HostsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addTerminalTab, tabs, setActiveTab } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connectingRef = useRef(false);

  const connectedHostIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tab of tabs) {
      if (tab.type === 'terminal' && tab.host?.id) {
        ids.add(tab.host.id);
      }
    }
    return ids;
  }, [tabs]);

  const loadData = useCallback(async () => {
    try {
      const { hosts: h, tags: t, keys: k } = await fetchAllHostData();
      setHosts(h);
      setTags(t);
      setKeys(k);
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick() {
      setMenuOpenId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

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

  async function handleDeleteTag(tag: string) {
    try {
      const affected = hosts.filter((h) => h.tags?.includes(tag));
      await Promise.all(
        affected.map((h) =>
          saveHost({
            host: { ...h, tags: h.tags ? h.tags.filter((t) => t !== tag) : [] },
          }),
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
    }
  }

  function openAddDialog() {
    setEditingHost(null);
    setDialogOpen(true);
  }

  function openEditDialog(host: HostConfig) {
    setEditingHost(host);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingHost(null);
    loadData();
  }

  async function openTerminal(host: HostConfig) {
    // If there's already a terminal tab for this host, switch to it instead of creating a duplicate
    const existingTab = tabs.find((t) => t.type === 'terminal' && t.host?.id === host.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      navigate('/');
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
      navigate('/');
    } catch (e) {
      notifyError(e);
    } finally {
      setConnectingId(null);
      connectingRef.current = false;
    }
  }

  function handleDelete(host: HostConfig) {
    setMenuOpenId(null);
    setConfirmDeleteId(host.id);
  }

  const filtered = useMemo(
    () =>
      hosts.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.hostname.includes(searchQuery)),
    [hosts, searchQuery],
  );

  const ungrouped = useMemo(() => filtered.filter((h) => !h.tags || h.tags.length === 0), [filtered]);
  const taggedSections = useMemo(
    () =>
      tags
        .map((t) => ({ tag: t, hosts: filtered.filter((h) => h.tags?.includes(t)) }))
        .filter((s) => s.hosts.length > 0),
    [filtered, tags],
  );

  const hasContent = taggedSections.length > 0 || ungrouped.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.search')}
            className="h-8 pl-9 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 ml-auto flex-shrink-0" onClick={openAddDialog}>
          <Plus size={14} />
          {t('sidebar.addHost')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {taggedSections.map(({ tag, hosts: th }) => (
          <div key={tag}>
            <div className="flex items-center gap-2 mb-2 group">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tag}</span>
              <Badge variant="ghost" className="h-4 px-1.5 text-[10px]">
                {th.length}
              </Badge>
              <button
                onClick={() => handleDeleteTag(tag)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="space-y-1">
              {th.map((h) => (
                <HostRow
                  key={h.id}
                  host={h}
                  connecting={connectingId === h.id}
                  connected={connectedHostIds.has(h.id)}
                  menuOpen={menuOpenId === h.id}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === h.id ? null : h.id)}
                  onOpenTerminal={() => openTerminal(h)}
                  onEdit={() => {
                    setMenuOpenId(null);
                    openEditDialog(h);
                  }}
                  onDelete={() => handleDelete(h)}
                />
              ))}
            </div>
          </div>
        ))}

        {ungrouped.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('sidebar.noTag')}
              </span>
              <Badge variant="ghost" className="h-4 px-1.5 text-[10px]">
                {ungrouped.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {ungrouped.map((h) => (
                <HostRow
                  key={h.id}
                  host={h}
                  connecting={connectingId === h.id}
                  connected={connectedHostIds.has(h.id)}
                  menuOpen={menuOpenId === h.id}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === h.id ? null : h.id)}
                  onOpenTerminal={() => openTerminal(h)}
                  onEdit={() => {
                    setMenuOpenId(null);
                    openEditDialog(h);
                  }}
                  onDelete={() => handleDelete(h)}
                />
              ))}
            </div>
          </div>
        )}

        {!hasContent && (
          <div className="flex flex-col items-center gap-4 pt-16 text-muted-foreground">
            <LayoutGrid size={32} className="opacity-20" />
            <span className="text-sm">{t('sidebar.noHosts')}</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddDialog}>
              <Plus size={14} />
              {t('sidebar.addHost')}
            </Button>
          </div>
        )}
      </div>

      <HostDialog open={dialogOpen} onClose={handleDialogClose} host={editingHost} tags={tags} keys={keys} />

      <DeleteHostDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
