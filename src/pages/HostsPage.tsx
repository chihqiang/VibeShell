import { useState, useEffect, useCallback } from 'react';
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
import { listHosts, listGroups, deleteHost, deleteGroup } from '@/apis/api/hosts';
import { listKeys } from '@/apis/api/keys';

export default function HostsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addTerminalTab } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [h, g, k] = await Promise.all([listHosts(), listGroups(), listKeys()]);
      setHosts(h);
      setGroups(g);
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

  async function handleDeleteGroup(group: string) {
    try {
      await deleteGroup({ group });
      setGroups((prev) => prev.filter((g) => g !== group));
      setHosts((prev) => prev.map((h) => (h.group === group ? { ...h, group: null } : h)));
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

  function openTerminal(host: HostConfig) {
    addTerminalTab(
      {
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        password: host.password || null,
        private_key_path: host.private_key_path || null,
      },
      host,
    );
    navigate('/');
  }

  function handleDelete(host: HostConfig) {
    setMenuOpenId(null);
    setConfirmDeleteId(host.id);
  }

  const filtered = hosts.filter(
    (h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.hostname.includes(searchQuery),
  );

  const ungrouped = filtered.filter((h) => !h.group);
  const groupedGroups = groups
    .map((g) => ({ group: g, hosts: filtered.filter((h) => h.group === g) }))
    .filter((g) => g.hosts.length > 0);

  const hasContent = groupedGroups.length > 0 || ungrouped.length > 0;

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
        {groupedGroups.map(({ group, hosts: gh }) => (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2 group">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group}</span>
              <Badge variant="ghost" className="h-4 px-1.5 text-[10px]">
                {gh.length}
              </Badge>
              <button
                onClick={() => handleDeleteGroup(group)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="space-y-1">
              {gh.map((h) => (
                <HostRow
                  key={h.id}
                  host={h}
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
                {t('sidebar.noGroup')}
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

      <HostDialog open={dialogOpen} onClose={handleDialogClose} host={editingHost} groups={groups} keys={keys} />

      <DeleteHostDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
