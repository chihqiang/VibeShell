import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Code, Pencil, Trash2, Settings2, Download } from 'lucide-react';
import { useFileActions } from '@/hooks/use-tab';
import RenameDialog from '@/components/sftp/dialogs/RenameDialog';
import EditDialog from '@/components/sftp/dialogs/EditDialog';
import ChmodDialog from '@/components/sftp/dialogs/ChmodDialog';
import ConfirmDialog from '@/components/sftp/dialogs/ConfirmDialog';
import { FileType } from '@/apis/types/sftp';
import type { FileEntry } from '@/apis/types/sftp';

interface ContextMenuProps {
  ctxMenu: { x: number; y: number; entry: FileEntry } | null;
  onClose: () => void;
  tabId: string | null;
  onRefresh: () => void;
  onDownload?: (entry: FileEntry) => void;
  hostname?: string;
  port?: number;
  username?: string;
}

export default function ContextMenu({
  ctxMenu,
  onClose,
  tabId,
  onRefresh,
  onDownload,
  hostname,
  port,
  username,
}: ContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  const entry = ctxMenu?.entry ?? null;

  const {
    renameOpen,
    renameValue,
    setRenameValue,
    editOpen,
    editContent,
    setEditContent,
    editSaving,
    editPath,
    chmodOpen,
    chmodFormData,
    setChmodFormData,
    chmodUsers,
    chmodGroups,
    chmodError,
    deleteConfirmOpen,
    dialogOpen,
    handleRenameOpenChange,
    handleEditOpenChange,
    handleChmodOpenChange,
    handleDeleteConfirmOpenChange,
    handleDelete,
    handleRename,
    doRename,
    doEdit,
    doSaveEdit,
    doDelete,
    handleChmod,
    doChmod,
    doDownload,
  } = useFileActions(entry, tabId, onClose, onRefresh, onDownload, hostname, port, username);

  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = dialogOpen;

  useEffect(() => {
    if (!ctxMenu) return;
    const handle = (e: MouseEvent) => {
      if (dialogOpenRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ctxMenu, onClose]);

  if (!ctxMenu && !dialogOpen) return null;

  const menuEntry = ctxMenu?.entry;

  return (
    <>
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            ref={menuRef}
            className="fixed z-50 w-36 rounded-lg border border-border bg-popover shadow-lg py-1"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 160),
              top: Math.min(ctxMenu.y, window.innerHeight - 200),
            }}
          >
            {menuEntry?.file_type === FileType.File && (
              <button
                onClick={doEdit}
                className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
              >
                <Code size={13} /> {t('sftp.edit')}
              </button>
            )}
            <button
              onClick={handleRename}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil size={13} /> {t('sftp.rename')}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors text-destructive cursor-pointer"
            >
              <Trash2 size={13} /> {t('sftp.delete')}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button
              onClick={handleChmod}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Settings2 size={13} /> {t('sftp.permissions')}
            </button>
            <button
              onClick={() => {
                onClose();
                doDownload();
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-xs text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Download size={13} /> {t('sftp.download')}
            </button>
          </div>
        </>
      )}

      <RenameDialog
        open={renameOpen}
        onOpenChange={handleRenameOpenChange}
        value={renameValue}
        onValueChange={setRenameValue}
        onConfirm={doRename}
      />

      <EditDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        content={editContent}
        onContentChange={setEditContent}
        saving={editSaving}
        path={editPath}
        onSave={doSaveEdit}
      />

      <ChmodDialog
        open={chmodOpen}
        onOpenChange={handleChmodOpenChange}
        formData={chmodFormData}
        onChange={setChmodFormData}
        onConfirm={doChmod}
        isDirectory={menuEntry?.file_type === FileType.Directory}
        users={chmodUsers}
        groups={chmodGroups}
        error={chmodError}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={handleDeleteConfirmOpenChange}
        title={t('sftp.delete')}
        message={t('sftp.deleteConfirm', { name: menuEntry?.name ?? '' })}
        onConfirm={doDelete}
        variant="destructive"
      />
    </>
  );
}
