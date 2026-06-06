import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sftpCreateFile, sftpCreateDir } from '@/apis/api/sftp';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, FilePlus, FolderPlus, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/hooks/use-notify';
import NewFileDialog from '@/components/sftp/dialogs/NewFileDialog';
import NewFolderDialog from '@/components/sftp/dialogs/NewFolderDialog';

interface SftpToolbarProps {
  tabId: string | null;
  currentPath: string;
  onRefresh: () => void;
  onUpload?: (paths: string[]) => void;
  activeTransferCount?: number;
  failedTransferCount?: number;
  onShowTransfers?: () => void;
}

export function SftpToolbar({
  tabId,
  currentPath,
  onRefresh,
  onUpload,
  activeTransferCount = 0,
  failedTransferCount = 0,
  onShowTransfers,
}: SftpToolbarProps) {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();

  const [mkfileOpen, setMkfileOpen] = useState(false);
  const [mkfileValue, setMkfileValue] = useState('');
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirValue, setMkdirValue] = useState('');

  const doUpload = async () => {
    if (!tabId) return;
    const files = await open({ multiple: true });
    if (files) onUpload?.(Array.isArray(files) ? files : [files]);
  };

  const doNewFile = async () => {
    if (!tabId || !mkfileValue.trim()) return;
    const rp = currentPath.replace(/\/?$/, '/') + mkfileValue.trim();
    try {
      await sftpCreateFile({ tabId, path: rp });
      notify(t('sftp.newFileSuccess'));
      setMkfileOpen(false);
      setMkfileValue('');
      onRefresh();
    } catch (e) {
      notifyError(`${t('sftp.newFileFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const doMkdir = async () => {
    if (!tabId || !mkdirValue.trim()) return;
    const newDir = currentPath.replace(/\/?$/, '/') + mkdirValue.trim();
    try {
      await sftpCreateDir({ tabId, path: newDir });
      notify(t('sftp.newFolderSuccess'));
      setMkdirOpen(false);
      setMkdirValue('');
      onRefresh();
    } catch (e) {
      notifyError(`${t('sftp.newFolderFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-secondary/20">
        <Button variant="ghost" size="xs" onClick={doUpload}>
          <Upload size={13} /> {t('sftp.upload')}
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setMkfileValue('');
            setMkfileOpen(true);
          }}
        >
          <FilePlus size={13} /> {t('sftp.newFile')}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setMkdirValue('');
            setMkdirOpen(true);
          }}
        >
          <FolderPlus size={13} /> {t('sftp.newFolder')}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onShowTransfers}
          className="relative"
          title={t('sftp.transfers')}
        >
          <ListTodo size={12} />
          {(activeTransferCount > 0 || failedTransferCount > 0) && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center">
              {activeTransferCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-3 h-3 px-1 rounded-full text-[8px] font-bold bg-primary text-primary-foreground">
                  {activeTransferCount}
                </span>
              )}
              {activeTransferCount > 0 && failedTransferCount > 0 && <span className="w-0.5" />}
              {failedTransferCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-3 h-3 px-1 rounded-full text-[8px] font-bold bg-destructive text-destructive-foreground">
                  {failedTransferCount}
                </span>
              )}
            </span>
          )}
        </Button>
      </div>

      <NewFileDialog
        open={mkfileOpen}
        onOpenChange={setMkfileOpen}
        value={mkfileValue}
        onValueChange={setMkfileValue}
        onConfirm={doNewFile}
      />
      <NewFolderDialog
        open={mkdirOpen}
        onOpenChange={setMkdirOpen}
        value={mkdirValue}
        onValueChange={setMkdirValue}
        onConfirm={doMkdir}
      />
    </>
  );
}
