import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, KeyRound, Plus, FolderOpen, FileText, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import KeyRow from '@/components/host/KeyRow';
import type { KeyEntry } from '@/api/keys';
import { useNotify } from '@/hooks/use-notify';
import { listKeys, importKey, importKeyContent, deleteKey } from '@/api/keys';

type ImportMode = 'file' | 'paste';

export default function KeysPage() {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('file');
  const [keyPath, setKeyPath] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [keyName, setKeyName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
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

  async function handleImportFromFile() {
    return await importKey({
      sourcePath: keyPath.trim(),
      name: keyName.trim() || null,
      password: passphrase.trim() || null,
    });
  }

  async function handleImportFromPaste() {
    return await importKeyContent({
      content: keyContent.trim(),
      name: keyName.trim() || 'pasted_key',
      password: passphrase.trim() || null,
    });
  }

  async function handleImport() {
    const valid = importMode === 'file' ? keyPath.trim() : keyContent.trim() && keyName.trim();
    if (!valid) return;
    setImporting(true);
    try {
      const result = importMode === 'file' ? await handleImportFromFile() : await handleImportFromPaste();
      setKeys((prev) => [...prev, result]);
      resetDialog();
    } catch (e) {
      notifyError(e, false);
      setImportError(String(e));
    } finally {
      setImporting(false);
    }
  }

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

  async function handleSelectFile() {
    try {
      const { open: showOpen } = await import('@tauri-apps/plugin-dialog');
      const selected = await showOpen({ multiple: false });
      if (selected) {
        setKeyPath(selected);
        if (!keyName) {
          const parts = selected.replace(/\\/g, '/').split('/');
          setKeyName(parts[parts.length - 1]);
        }
      }
    } catch (e) {
      notifyError(e);
    }
  }

  function resetDialog() {
    setImportOpen(false);
    setImportMode('file');
    setKeyPath('');
    setKeyContent('');
    setKeyName('');
    setPassphrase('');
    setImportError('');
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

      {/* Import Dialog */}
      <Dialog
        open={importOpen}
        onOpenChange={(next) => {
          if (!next) resetDialog();
        }}
      >
        <DialogContent className="w-[480px] sm:max-w-[480px] p-0">
          <DialogHeader>
            <DialogTitle>{t('sidebar.importKeyTitle')}</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            <div>
              <Label className="after:content-['*'] after:text-destructive after:ml-0.5">{t('sidebar.keyName')}</Label>
              <Input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder={t('sidebar.keyNamePlaceholder')}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{t('sidebar.importKeyTitle')}</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={importMode === 'file' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setImportMode('file')}
                >
                  <FolderOpen size={14} />
                  {t('sidebar.keyImportModeFile')}
                </Button>
                <Button
                  variant={importMode === 'paste' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setImportMode('paste')}
                >
                  <FileText size={14} />
                  {t('sidebar.keyImportModePaste')}
                </Button>
              </div>
            </div>

            {importMode === 'file' ? (
              <div>
                <Label className="after:content-['*'] after:text-destructive after:ml-0.5">
                  {t('sidebar.keySelectFile')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={keyPath}
                    readOnly
                    placeholder={t('sidebar.keySelected')}
                    className="flex-1 text-xs text-muted-foreground"
                  />
                  <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={handleSelectFile}>
                    <FolderOpen size={14} />
                    {t('sidebar.keySelectFile')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label className="after:content-['*'] after:text-destructive after:ml-0.5">
                  {t('sidebar.keyContent')}
                </Label>
                <textarea
                  value={keyContent}
                  onChange={(e) => setKeyContent(e.target.value)}
                  placeholder={t('sidebar.keyContentPlaceholder')}
                  className="flex w-full h-28 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground resize-none outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>
            )}

            <div>
              <Label>{t('sidebar.keyPassphrase')}</Label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t('sidebar.keyPassphrasePlaceholder')}
                  className="h-8 pl-9 text-xs"
                />
              </div>
            </div>

            {importError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{importError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={resetDialog}>
                {t('connection.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={
                  importing || !keyName.trim() || (importMode === 'file' ? !keyPath.trim() : !keyContent.trim())
                }
                onClick={handleImport}
              >
                {importing ? t('common.loading') : t('sidebar.importKey')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
