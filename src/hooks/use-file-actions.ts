import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sftpRename, sftpReadFile, sftpWriteFile, sftpDeleteFile, sftpGetUsersGroups, sftpChmod } from '@/api/sftp';
import { FileType } from '@/components/sftp/types';
import type { FileEntry } from '@/components/sftp/types';
import { useNotify } from '@/hooks/use-notify';
import { getCachedUsersGroups, setCachedUsersGroups } from '@/storage/users-groups';

export type ChmodFormData = {
  mode: string;
  uid: string;
  gid: string;
  recursive: boolean;
};

export function useFileActions(
  entry: FileEntry | null,
  tabId: string | null,
  onClose: () => void,
  onRefresh: () => void,
  onDownload?: (entry: FileEntry) => void,
  hostname?: string,
  port?: number,
  username?: string,
) {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();

  const activeEntry = useRef<FileEntry | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editPath, setEditPath] = useState('');

  const [chmodOpen, setChmodOpen] = useState(false);
  const [chmodFormData, setChmodFormData] = useState<ChmodFormData>({
    mode: '755',
    uid: '',
    gid: '',
    recursive: false,
  });
  const [chmodUsers, setChmodUsers] = useState<string[]>([]);
  const [chmodGroups, setChmodGroups] = useState<string[]>([]);
  const [chmodError, setChmodError] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const dialogOpen = editOpen || renameOpen || chmodOpen || deleteConfirmOpen;

  const handleRenameOpenChange = useCallback(
    (open: boolean) => {
      setRenameOpen(open);
      if (!open) onClose();
    },
    [onClose],
  );

  const handleEditOpenChange = useCallback(
    (open: boolean) => {
      setEditOpen(open);
      if (!open) onClose();
    },
    [onClose],
  );

  const handleChmodOpenChange = useCallback(
    (open: boolean) => {
      setChmodOpen(open);
      if (!open) onClose();
    },
    [onClose],
  );

  const handleDeleteConfirmOpenChange = useCallback(
    (open: boolean) => {
      setDeleteConfirmOpen(open);
      if (!open) onClose();
    },
    [onClose],
  );

  const handleRename = useCallback(() => {
    if (!entry) return;
    activeEntry.current = entry;
    setRenameValue(entry.name);
    setRenameOpen(true);
    onClose();
  }, [entry, onClose]);

  const doRename = useCallback(async () => {
    const e = activeEntry.current;
    if (!e || !tabId || !renameValue.trim()) return;
    const dir = e.path.substring(0, e.path.lastIndexOf('/') + 1) || '/';
    const newPath = dir + renameValue.trim();
    try {
      await sftpRename({ tabId, oldPath: e.path, newPath });
      notify(t('sftp.renameSuccess'));
      setRenameOpen(false);
      onRefresh();
    } catch (e) {
      notifyError(`${t('sftp.renameFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [renameValue, tabId, t, onRefresh, notify, notifyError]);

  const doEdit = useCallback(async () => {
    if (!entry || entry.file_type !== FileType.File || !tabId) return;
    activeEntry.current = entry;
    const e = activeEntry.current;
    const path = e.path;
    setEditPath(path);
    setEditContent(t('common.loading'));
    setEditOpen(true);
    onClose();
    try {
      const contentBytes = await sftpReadFile({ tabId, path });
      const content = new TextDecoder().decode(new Uint8Array(contentBytes));
      setEditContent(content);
    } catch (e) {
      notifyError(e);
      setEditContent(`${t('common.error')} loading file`);
    }
  }, [entry, tabId, t, notifyError, onClose]);

  const doSaveEdit = useCallback(async () => {
    setEditSaving(true);
    try {
      await sftpWriteFile({
        tabId: tabId!,
        path: editPath,
        content: editContent,
      });
      notify(t('sftp.saveSuccess'));
      setEditOpen(false);
    } catch (e) {
      notifyError(`${t('sftp.saveFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEditSaving(false);
    }
  }, [tabId, editPath, editContent, t, notify, notifyError]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    activeEntry.current = entry;
    setDeleteConfirmOpen(true);
    onClose();
  }, [entry, onClose]);

  const doDelete = useCallback(async () => {
    const e = activeEntry.current;
    if (!e || !tabId) return;
    try {
      await sftpDeleteFile({
        tabId,
        path: e.path,
        isDirectory: e.file_type === FileType.Directory,
      });
      notify(t('sftp.deleteSuccess'));
      setDeleteConfirmOpen(false);
      onRefresh();
    } catch (e) {
      notifyError(`${t('sftp.deleteFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [tabId, t, onRefresh, notify, notifyError]);

  const handleChmod = useCallback(() => {
    if (!entry) return;
    activeEntry.current = entry;
    if (!tabId) return;
    setChmodError('');
    setChmodFormData({
      mode: entry.perm?.toString(8) || '755',
      uid: entry.user || '',
      gid: entry.group || '',
      recursive: false,
    });
    setChmodOpen(true);
    onClose();

    const ch = hostname || tabId || '';
    const cp = port ?? 0;
    const cu = username || '';
    const cached = getCachedUsersGroups(ch, cp, cu);
    if (cached) {
      setChmodUsers(cached.users);
      setChmodGroups(cached.groups);
    } else {
      sftpGetUsersGroups({ tabId })
        .then((r) => {
          setCachedUsersGroups(ch, cp, cu, r);
          setChmodUsers(r.users);
          setChmodGroups(r.groups);
        })
        .catch((e) => {
          notifyError(e);
          setChmodUsers([]);
          setChmodGroups([]);
        });
    }
  }, [entry, tabId, notifyError, hostname, port, username, onClose]);

  const doChmod = useCallback(async () => {
    const e = activeEntry.current;
    if (!e || !tabId) return;
    setChmodError('');
    try {
      await sftpChmod({
        tabId,
        path: e.path,
        mode: chmodFormData.mode,
        user: chmodFormData.uid !== e.user ? chmodFormData.uid : null,
        group: chmodFormData.gid !== e.group ? chmodFormData.gid : null,
        recursive: chmodFormData.recursive,
        isDirectory: e.file_type === 'directory',
      });
      notify(t('sftp.chmodSuccess'));
      setChmodOpen(false);
      onRefresh();
    } catch (e) {
      notifyError(e);
      setChmodError(String(e));
    }
  }, [tabId, chmodFormData, t, onRefresh, notify, notifyError]);

  const doDownload = useCallback(() => {
    if (!entry) return;
    onDownload?.(entry);
  }, [entry, onDownload]);

  return {
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
    setDeleteConfirmOpen,
    dialogOpen,
    handleRenameOpenChange,
    handleEditOpenChange,
    handleChmodOpenChange,
    handleDeleteConfirmOpenChange,
    handleRename,
    doRename,
    doEdit,
    doSaveEdit,
    handleDelete,
    doDelete,
    handleChmod,
    doChmod,
    doDownload,
  };
}
