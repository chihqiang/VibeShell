import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listKeys, deleteKey } from '@/apis/api/keys';
import { Search, Upload, Trash2, FileKey } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImportKeyDialog from '@/components/keys/dialogs/ImportKeyDialog';
import type { KeyEntry } from '@/apis/types/keys';
import { useNotify } from '@/hooks/use-notify';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyManagementDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const k = await listKeys();
      setKeys(k);
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    if (open) loadKeys();
  }, [open, loadKeys]);

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    try {
      await deleteKey({ id: confirmDeleteId });
      setKeys((prev) => prev.filter((k) => k.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      notifyError(e);
      setConfirmDeleteId(null);
    }
  }

  const filtered = keys.filter(
    (k) => k.name.toLowerCase().includes(searchQuery.toLowerCase()) || k.fingerprint.includes(searchQuery),
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
            <DialogTitle className="text-sm font-semibold">{t('sidebar.keyManagement')}</DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.searchKeys')}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 gap-1" onClick={() => setImportOpen(true)}>
              <Upload size={14} />
              {t('sidebar.importKey')}
            </Button>
          </div>

          <div className="px-4 pb-4 max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8">{t('sidebar.noKeys')}</div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <FileKey size={14} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">{key.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">{key.fingerprint}</div>
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                      {key.key_type}
                    </span>
                    <button
                      onClick={() => setConfirmDeleteId(key.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer ml-2"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImportKeyDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => loadKeys()} />

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="w-[360px] sm:max-w-[360px] p-0">
          <DialogHeader>
            <DialogTitle>{t('sidebar.confirmDeleteKey')}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="px-5 pb-4 pt-0">
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                {t('connection.cancel')}
              </Button>
              <Button size="sm" variant="destructive" onClick={confirmDelete}>
                {t('connection.delete')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
