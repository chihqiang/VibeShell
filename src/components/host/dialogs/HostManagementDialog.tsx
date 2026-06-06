import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Pencil, Trash2, Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HostDialog from '@/components/host/dialogs/HostDialog';
import DeleteHostDialog from '@/components/host/dialogs/DeleteHostDialog';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { useNotify } from '@/hooks/use-notify';
import { listHosts, listGroups, deleteHost } from '@/apis/api/hosts';
import { listKeys } from '@/apis/api/keys';
import { sshTestConnect } from '@/apis/api/ssh';
import { resolvePrivateKeyPath } from '@/apis/utils/keys';
import { buildSshConfig } from '@/lib/utils';
import type { AuthMethod } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HostManagementDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addTerminalTab } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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
    if (open) loadData();
  }, [open, loadData]);

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
    if (connecting) return;
    setConnecting(true);
    try {
      const privateKeyPath = await resolvePrivateKeyPath(host, keys);
      const config = buildSshConfig({
        authMethod: host.auth_method as AuthMethod,
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        password: host.auth_method === 'password' ? host.password || null : null,
        keyPassphrase: host.auth_method === 'key' ? host.password || null : null,
        privateKeyPath,
      });
      await sshTestConnect({
        hostname: config.hostname,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKeyPath: config.private_key_path,
      });
      addTerminalTab(config, host);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setConnecting(false);
    }
  }

  const filtered = hosts.filter(
    (h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.hostname.includes(searchQuery),
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[600px] sm:max-w-[600px] p-0">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{t('sidebar.hostManagement')}</DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.search')}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 gap-1" onClick={openAddDialog}>
              <Plus size={14} />
              {t('sidebar.addHost')}
            </Button>
          </div>

          <div className="px-4 pb-4 max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8">{t('sidebar.noHosts')}</div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((h) => (
                  <div
                    key={h.id}
                    className="group flex items-center gap-3 h-9 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    onDoubleClick={() => openTerminal(h)}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-xs text-foreground flex-1 truncate">{h.name}</span>
                    <span className="text-[11px] text-muted-foreground">{h.hostname}</span>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTerminal(h);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                        title={t('connection.openTerminal')}
                      >
                        <Terminal size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(h);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                        title={t('connection.edit')}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(h.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors cursor-pointer"
                        title={t('connection.delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <HostDialog open={dialogOpen} onClose={handleDialogClose} host={editingHost} groups={groups} keys={keys} />

      <DeleteHostDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
