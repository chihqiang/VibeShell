import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { importKey, importKeyContent } from '@/api/keys';
import { FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { KeyEntry } from '@/api/keys';
import { useNotify } from '@/hooks/use-notify';

type ImportMode = 'file' | 'paste';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (key: KeyEntry) => void;
}

export default function ImportKeyDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const [mode, setMode] = useState<ImportMode>('file');
  const [name, setName] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [importing, setImporting] = useState(false);

  async function handleFilePick() {
    try {
      const { open: showOpen } = await import('@tauri-apps/plugin-dialog');
      const selected = await showOpen({
        multiple: false,
      });
      if (selected) {
        setSelectedFile(selected);
        if (!name) {
          const parts = selected.replace(/\\/g, '/').split('/');
          setName(parts[parts.length - 1].replace(/\.(pub|pem)$/, ''));
        }
      }
    } catch (e) {
      notifyError(e);
    }
  }

  async function handleImport() {
    if (!name) return;
    setImporting(true);
    try {
      let result: KeyEntry;
      if (mode === 'file') {
        if (!selectedFile) {
          setImporting(false);
          return;
        }
        result = await importKey({
          sourcePath: selectedFile,
          name,
          password: passphrase || null,
        });
      } else {
        if (!keyContent) {
          setImporting(false);
          return;
        }
        result = await importKeyContent({
          content: keyContent,
          name,
          password: passphrase || null,
        });
      }
      reset();
      onImported?.(result);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setMode('file');
    setName('');
    setKeyContent('');
    setSelectedFile('');
    setPassphrase('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="w-[480px] sm:max-w-[480px] p-0">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{t('sidebar.importKeyTitle')}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-3 max-h-[420px] overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('sidebar.keyName')} *</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              placeholder={t('sidebar.keyNamePlaceholder')}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('file')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors flex items-center gap-1.5',
                mode === 'file'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              <FolderOpen size={12} />
              {t('sidebar.keyImportModeFile')}
            </button>
            <button
              onClick={() => setMode('paste')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors flex items-center gap-1.5',
                mode === 'paste'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              <FileText size={12} />
              {t('sidebar.keyImportModePaste')}
            </button>
          </div>

          {mode === 'file' ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t('sidebar.keySelectFile')}</span>
              <div className="flex items-center gap-2">
                <Input
                  value={selectedFile}
                  readOnly
                  className="h-8 text-xs flex-1 font-mono"
                  placeholder={t('sidebar.keySelected')}
                />
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleFilePick}>
                  <FolderOpen size={12} />
                  {t('sidebar.keySelectFile')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t('sidebar.keyContent')}</span>
              <textarea
                value={keyContent}
                onChange={(e) => setKeyContent(e.target.value)}
                className="w-full h-24 text-xs font-mono bg-muted border border-border rounded-md px-3 py-2 resize-none outline-none focus:border-primary transition-colors"
                placeholder={t('sidebar.keyContentPlaceholder')}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('sidebar.keyPassphrase')}</span>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="h-8 text-xs"
              placeholder={t('sidebar.keyPassphrasePlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="px-5 pb-4">
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {t('connection.cancel')}
            </Button>
            <Button size="sm" onClick={handleImport} disabled={!name || importing}>
              {importing ? t('common.loading') : t('sidebar.importKey')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
