import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, KeyRound, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import KeyRow from '@/components/keys/KeyRow';
import ImportKeyDialog from '@/components/keys/dialogs/ImportKeyDialog';
import DeleteKeyDialog from '@/components/keys/dialogs/DeleteKeyDialog';
import type { KeyEntry } from '@/apis/types/keys';
import { useNotify } from '@/hooks/use-notify';
import { listKeys, deleteKey } from '@/apis/api/keys';

export default function KeysPage() {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setDeleteError('');
    try {
      await deleteKey({ id: confirmDeleteId });
      setKeys((prev) => prev.filter((k) => k.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      notifyError(e, false);
      setDeleteError(String(e));
      setConfirmDeleteId(null);
    }
  }

  const filtered = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.key_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.fingerprint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.file_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.searchKeys')}
            className="h-8 pl-9 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 ml-auto flex-shrink-0"
          onClick={() => setImportOpen(true)}
        >
          <Plus size={14} />
          {t('sidebar.importKey')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-1">
        {deleteError && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2 mb-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-16 text-muted-foreground">
            <KeyRound size={32} className="opacity-20" />
            <span className="text-sm">{t('sidebar.noKeys')}</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Plus size={14} />
              {t('sidebar.importKey')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-16 text-muted-foreground">
            <KeyRound size={32} className="opacity-20" />
            <span className="text-sm">{t('sidebar.noKeys')}</span>
          </div>
        ) : (
          filtered.map((k) => <KeyRow key={k.id} keyEntry={k} onDelete={() => setConfirmDeleteId(k.id)} />)
        )}
      </div>

      <ImportKeyDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(key) => setKeys((prev) => [...prev, key])}
      />

      <DeleteKeyDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
