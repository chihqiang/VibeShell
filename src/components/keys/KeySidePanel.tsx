import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, FileKey, Lock } from 'lucide-react';
import { useLayout } from '@/contexts/LayoutContext';
import { useNotify } from '@/hooks/use-notify';
import { listKeys, deleteKey, getKeyReferrers } from '@/services/keyService';
import type { KeyEntry } from '@/types/key';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteDialog } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ImportKeyDialog } from '@/components/keys';
import { PanelHeader } from '@/components/layout/SidePanel';

/** 密钥管理侧边栏面板 */
export function KeySidePanel() {
  const { t } = useTranslation();
  const { setActiveView } = useLayout();
  const { notifyError } = useNotify();
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; referrers: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadKeys = useCallback(async () => {
    try {
      const result = await listKeys();
      setKeys(result);
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const initiateDelete = useCallback(
    async (keyId: string, keyName: string) => {
      try {
        const referrers = await getKeyReferrers({ keyId });
        setDeleteTarget({ id: keyId, name: keyName, referrers });
      } catch (e) {
        notifyError(e);
      }
    },
    [notifyError],
  );

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    if (target.referrers.length > 0) return; // should not reach here
    try {
      await deleteKey({ id: target.id });
      setKeys((prev) => prev.filter((k) => k.id !== target.id));
      setDeleteTarget(null);
    } catch (e) {
      notifyError(e);
      setDeleteTarget(null);
    }
  }

  const filtered = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.key_type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <PanelHeader title={t('sidebar.keyManagement')} onClose={() => setActiveView(null)} />

      <div className="px-2.5 py-2 border-b border-border/60 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.searchKeys')}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="flex-shrink-0"
          onClick={() => setImportOpen(true)}
          title={t('sidebar.importKey')}
        >
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-12 px-4 text-muted-foreground">
            <FileKey size={28} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noKeys')}</span>
            <Button variant="outline" size="xs" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Plus size={13} />
              {t('sidebar.importKey')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-12 px-4 text-muted-foreground">
            <Search size={24} className="opacity-20" />
            <span className="text-xs text-center">{t('sidebar.noKeys')}</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((key) => (
              <KeySideRow key={key.id} keyEntry={key} onDelete={() => initiateDelete(key.id, key.name)} />
            ))}
          </div>
        )}
      </div>

      <ImportKeyDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => loadKeys()} />
      <DeleteDialog
        open={deleteTarget !== null && deleteTarget.referrers.length === 0}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        titleKey="sidebar.confirmDeleteKey"
      />
      {deleteTarget && deleteTarget.referrers.length > 0 && (
        <Dialog open={true} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent showCloseButton={false} className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('sidebar.cannotDeleteKey')}</DialogTitle>
            </DialogHeader>
            <p className="px-5 text-sm text-muted-foreground">
              {t('sidebar.keyInUseBy', { count: deleteTarget.referrers.length })}
            </p>
            <ul className="px-5 text-xs space-y-1 list-disc list-inside text-foreground">
              {deleteTarget.referrers.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  {t('common.close')}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function KeySideRow({ keyEntry: k, onDelete }: { keyEntry: KeyEntry; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 h-10 px-3 hover:bg-muted/60 transition-colors cursor-default">
      <FileKey size={14} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground truncate">{k.name}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          {k.password && <Lock size={10} className="flex-shrink-0" />}
          <span className="uppercase">{k.key_type}</span>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
