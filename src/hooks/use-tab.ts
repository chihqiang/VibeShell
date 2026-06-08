import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { sshConnect } from '@/apis/api/ssh';
import {
  sftpListFilesRecursive,
  sftpUploadFileProgress,
  sftpDownloadFileProgress,
  sftpCancelTransfer,
  sftpRename,
  sftpReadFile,
  sftpWriteFile,
  sftpDeleteFile,
  sftpGetUsersGroups,
  sftpChmod,
} from '@/apis/api/sftp';
import { expandLocalFiles } from '@/apis/utils/sftp';
import { FileType } from '@/apis/types/sftp';
import type { FileEntry } from '@/apis/types/sftp';
import type { ConnectionConfig, TransferItem, SftpProgressPayload, ChmodFormData } from '@/lib/types';
import { TRANSFER_STORAGE_KEY } from '@/lib/types';
import { useNotify } from '@/hooks/use-notify';
import { runWithConcurrency } from '@/lib/utils';
import { getCachedUsersGroups, setCachedUsersGroups } from '@/storage/users-groups';

// ── useSftpConnection ──

export function useSftpConnection(conn: ConnectionConfig | undefined): string | null {
  const [tabId, setTabId] = useState<string | null>(null);
  const tabIdRef = useRef<string | null>(null);
  const { notifyError } = useNotify();

  useEffect(() => {
    if (!conn) return;

    let cancelled = false;
    tabIdRef.current = null;

    const tid = crypto.randomUUID();

    (async () => {
      try {
        await sshConnect({
          tabId: tid,
          hostname: conn.hostname,
          port: conn.port,
          username: conn.username,
          password: conn.authMethod === 'password' ? conn.password : conn.keyPassphrase || null,
          privateKeyPath: conn.authMethod === 'key' ? conn.privateKeyPath : null,
        });
        if (cancelled) return;
        tabIdRef.current = tid;
        setTabId(tid);
      } catch (e) {
        if (!cancelled) notifyError(e);
      }
    })();

    return () => {
      cancelled = true;
      const id = tabIdRef.current;
      if (id) {
        import('@/apis/api/ssh').then(({ sshDisconnect }) => {
          sshDisconnect({ tabId: id }).catch((e) => notifyError(e, false));
        });
      }
    };
  }, [conn, notifyError]);

  return tabId;
}

// ── useSftpDragDrop ──

export function useSftpDragDrop(tabId: string | null, onDrop: (paths: string[]) => Promise<void>): boolean {
  const [isDragging, setIsDragging] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    if (!tabId) return;
    const wv = getCurrentWebview();
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    wv.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragging(true);
      } else if (event.payload.type === 'leave') {
        setIsDragging(false);
      } else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths.length === 0) return;
        onDropRef.current(paths);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlistenFn = fn;
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [tabId]);

  return isDragging;
}

// ── useSftpTransfers ──

function loadPersistedTransfers(notifyError?: (msg: string | unknown) => void): TransferItem[] {
  try {
    const raw = localStorage.getItem(TRANSFER_STORAGE_KEY);
    if (raw) {
      const items: TransferItem[] = JSON.parse(raw);
      return items.map((item) => ({
        ...item,
        direction: item.direction || 'upload',
      }));
    }
  } catch (e) {
    notifyError?.(e);
  }
  return [];
}

export function useSftpTransfers(tabId: string | null, currentPath: string, loadDir: (dir: string) => Promise<void>) {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();

  const [transfers, setTransfers] = useState<TransferItem[]>(() => loadPersistedTransfers(notifyError));
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const processingRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced localStorage persistence — avoids serializing on every progress tick
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      try {
        localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify(transfers));
      } catch (e) {
        notifyError(e, false);
      }
    }, 300);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [transfers, notifyError]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;
    listen<SftpProgressPayload>('sftp://transfer-progress', (event) => {
      const { transferId, current, total, phase } = event.payload;
      setTransfers((prev) =>
        prev.map((x) =>
          x.id === transferId
            ? {
                ...x,
                current,
                total: total > x.total ? total : x.total,
                status: current >= total ? 'completed' : phase === 'downloading' ? 'downloading' : 'uploading',
              }
            : x,
        ),
      );
    })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch((e) => notifyError(e));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [notifyError]);

  const addTransfers = useCallback(
    async (paths: string[]) => {
      if (!tabId) return;
      if (processingRef.current) return;
      processingRef.current = true;

      const { files: expanded, failures } = await expandLocalFiles(paths, currentPath);

      const newItems: TransferItem[] = [];

      for (const f of failures) {
        if (f.error.startsWith('sftp.')) {
          notify(t(f.error));
        } else {
          notifyError(f.error);
          newItems.push({
            id: crypto.randomUUID(),
            name: f.name,
            localPath: f.localPath,
            remotePath: f.remotePath,
            current: 0,
            total: 0,
            status: 'failed',
            direction: 'upload',
            error: f.error,
          });
        }
      }

      for (const f of expanded) {
        newItems.push({
          id: crypto.randomUUID(),
          name: f.name,
          localPath: f.localPath,
          remotePath: f.remotePath,
          current: 0,
          total: f.fileSize,
          status: 'pending',
          direction: 'upload',
        });
      }

      setTransfers((prev) => {
        const prevActive = prev.filter(
          (x) =>
            x.status === 'pending' || x.status === 'uploading' || x.status === 'downloading' || x.status === 'paused',
        );
        return [...newItems, ...prevActive];
      });
      setTransfersOpen(true);

      const pendingItems = newItems.filter((item) => item.status === 'pending');
      await runWithConcurrency(pendingItems, 4, async (item) => {
        try {
          setTransfers((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading' } : x)));
          await sftpUploadFileProgress({
            tabId,
            localPath: item.localPath,
            remotePath: item.remotePath,
            transferId: item.id,
          });
          setTransfers((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, status: 'completed', current: x.total } : x)),
          );
        } catch (e) {
          notifyError(e);
          setTransfers((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: String(e) } : x)),
          );
        }
      });

      processingRef.current = false;
      loadDir(currentPath);
    },
    [tabId, currentPath, loadDir, notify, notifyError, t],
  );

  const handleCancel = async (id: string) => {
    try {
      await sftpCancelTransfer({ transferId: id });
      setTransfers((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: 'failed', error: t('sftp.transferCancelled') } : x)),
      );
    } catch (e) {
      notifyError(e);
    }
  };

  const handleRetry = async (item: TransferItem) => {
    if (!tabId) return;
    setTransfers((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading', current: 0, error: undefined } : x)),
    );
    try {
      if (item.direction === 'download') {
        await sftpDownloadFileProgress({
          tabId,
          remotePath: item.remotePath,
          localPath: item.localPath,
          transferId: item.id,
        });
      } else {
        await sftpUploadFileProgress({
          tabId,
          localPath: item.localPath,
          remotePath: item.remotePath,
          transferId: item.id,
        });
      }
      setTransfers((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'completed', current: x.total } : x)));
    } catch (e) {
      notifyError(e);
      setTransfers((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: String(e) } : x)));
    }
    loadDir(currentPath);
  };

  const handleRemove = (id: string) => {
    setTransfers((prev) => prev.filter((x) => x.id !== id));
  };

  const handleClearCompleted = () => {
    setTransfers((prev) => prev.filter((x) => x.status !== 'completed' && x.status !== 'failed'));
  };

  const handleDownload = useCallback(
    async (entry: FileEntry) => {
      if (!tabId) return;

      if (entry.file_type === FileType.Directory) {
        const dest = await save({ defaultPath: entry.name });
        if (!dest) return;

        let files: string[];
        try {
          files = await sftpListFilesRecursive({ tabId, path: entry.path });
        } catch (e) {
          notifyError(`${t('sftp.downloadFailed')}: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
        if (files.length === 0) {
          notify(t('sftp.empty'));
          return;
        }

        const basePath = entry.path;
        const newItems: TransferItem[] = [];
        for (const remoteFile of files) {
          if (!remoteFile.startsWith(basePath)) continue;
          const relPath = remoteFile.substring(basePath.length).replace(/^\//, '');
          const localPath = dest + '/' + relPath;
          newItems.push({
            id: crypto.randomUUID(),
            name: relPath,
            localPath,
            remotePath: remoteFile,
            current: 0,
            total: 0,
            status: 'pending',
            direction: 'download',
          });
        }

        setTransfers((prev) => [...newItems, ...prev]);
        setTransfersOpen(true);

        await runWithConcurrency(newItems, 4, async (item) => {
          setTransfers((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'downloading' } : x)));
          try {
            await sftpDownloadFileProgress({
              tabId,
              remotePath: item.remotePath,
              localPath: item.localPath,
              transferId: item.id,
            });
            setTransfers((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, status: 'completed', current: x.total || 1 } : x)),
            );
          } catch (e) {
            notifyError(e);
            setTransfers((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: String(e) } : x)),
            );
          }
        });
        return;
      }

      // Single file download
      const dest = await save({
        defaultPath: entry.name,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });
      if (!dest) return;

      const id = crypto.randomUUID();
      const item: TransferItem = {
        id,
        name: entry.name,
        localPath: dest,
        remotePath: entry.path,
        current: 0,
        total: entry.size,
        status: 'pending',
        direction: 'download',
      };

      setTransfers((prev) => [item, ...prev]);
      setTransfersOpen(true);
      setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'downloading' } : x)));

      try {
        await sftpDownloadFileProgress({
          tabId,
          remotePath: entry.path,
          localPath: dest,
          transferId: id,
        });
        setTransfers((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status: 'completed', current: x.total || 1 } : x)),
        );
      } catch (e) {
        notifyError(e);
        setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'failed', error: String(e) } : x)));
      }
    },
    [tabId, t, notify, notifyError],
  );

  const activeTransferCount = transfers.filter(
    (x) => x.status === 'pending' || x.status === 'uploading' || x.status === 'downloading',
  ).length;
  const failedTransferCount = transfers.filter((x) => x.status === 'failed').length;

  return {
    transfers,
    activeTransferCount,
    failedTransferCount,
    transfersOpen,
    setTransfersOpen,
    transferDialogOpen,
    setTransferDialogOpen,
    addTransfers,
    handleCancel,
    handleRetry,
    handleRemove,
    handleClearCompleted,
    handleDownload,
  };
}

// ── useFileActions ──

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
