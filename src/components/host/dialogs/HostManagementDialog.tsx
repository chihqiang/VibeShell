import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Pencil, Trash2, Terminal, Folder, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import HostDialog from '@/components/host/dialogs/HostDialog';
import DeleteHostDialog from '@/components/host/dialogs/DeleteHostDialog';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { useNotify } from '@/hooks/use-notify';
import { listHosts, deleteHost, saveHost } from '@/apis/api/hosts';
import { listKeys } from '@/apis/api/keys';
import { sshTestConnect } from '@/apis/api/ssh';
import { resolvePrivateKeyPath } from '@/apis/utils/keys';
import { buildSshConfig } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ALL_TAG = '__all__';
const UNTAGGED = '__untagged__';

export default function HostManagementDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addTerminalTab } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedTag, setSelectedTag] = useState(ALL_TAG);

  const loadData = useCallback(async () => {
    try {
      const [h, k] = await Promise.all([listHosts(), listKeys()]);
      setHosts(h);
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
        authMethod: host.auth_method,
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
      const now = Date.now();
      addTerminalTab(config, host);
      await saveHost({ host: { ...host, last_connected_at: now } });
      setHosts((prev) => prev.map((h) => (h.id === host.id ? { ...h, last_connected_at: now } : h)));
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setConnecting(false);
    }
  }

  const sectionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const h of hosts) {
      if (h.tags && h.tags.length > 0) {
        for (const t of h.tags) keys.add(t);
      } else {
        keys.add(UNTAGGED);
      }
    }
    return [
      ALL_TAG,
      ...Array.from(keys).sort((a, b) => {
        if (a === UNTAGGED) return 1;
        if (b === UNTAGGED) return -1;
        return a.localeCompare(b);
      }),
    ];
  }, [hosts]);

  const sectionLabel = (key: string) => {
    if (key === ALL_TAG) return t('sidebar.hostManagement');
    if (key === UNTAGGED) return t('sidebar.noTag');
    return key;
  };

  const sectionIcon = (key: string) => {
    if (key === ALL_TAG) return <Globe size={13} />;
    return <Folder size={13} />;
  };

  const sectionCount = (key: string) => {
    if (key === ALL_TAG) return hosts.length;
    if (key === UNTAGGED) return hosts.filter((h) => !h.tags || h.tags.length === 0).length;
    return hosts.filter((h) => h.tags?.includes(key)).length;
  };

  const displayedHosts = useMemo(() => {
    let list = hosts;
    if (selectedTag === UNTAGGED) {
      list = list.filter((h) => !h.tags || h.tags.length === 0);
    } else if (selectedTag !== ALL_TAG) {
      list = list.filter((h) => h.tags?.includes(selectedTag));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q) || h.hostname.includes(q));
    }
    return list;
  }, [hosts, selectedTag, searchQuery]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[760px] sm:max-w-[760px] p-0">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{t('sidebar.hostManagement')}</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[460px] min-h-[300px]">
            <div className="w-44 border-r border-border overflow-y-auto shrink-0">
              {sectionKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedTag(key)}
                  className={`flex items-center gap-2 w-full h-8 px-3 text-xs text-left transition-colors cursor-pointer ${
                    selectedTag === key
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {sectionIcon(key)}
                  <span className="truncate flex-1">{sectionLabel(key)}</span>
                  <span className="text-[10px] text-muted-foreground">{sectionCount(key)}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('sidebar.search')}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
                <button
                  onClick={openAddDialog}
                  className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                  title={t('sidebar.addHost')}
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {displayedHosts.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-8">{t('sidebar.noHosts')}</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground sticky top-0 bg-background">
                        <th className="text-left font-medium px-3 py-2">{t('quickConnect.tableName')}</th>
                        <th className="text-left font-medium px-3 py-2">{t('quickConnect.hostname')}</th>
                        <th className="text-left font-medium px-3 py-2 w-16">{t('quickConnect.port')}</th>
                        <th className="text-left font-medium px-3 py-2 w-28">{t('quickConnect.tableAccount')}</th>
                        <th className="text-right font-medium px-3 py-2 w-24">{t('quickConnect.connect')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedHosts.map((h) => (
                        <tr
                          key={h.id}
                          onClick={() => openTerminal(h)}
                          className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2 text-foreground">{h.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.hostname}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.port}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.username}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HostDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        host={editingHost}
        tags={Array.from(new Set(hosts.flatMap((h) => h.tags || [])))}
        keys={keys}
      />

      <DeleteHostDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
