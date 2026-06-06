import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { sshConnect } from '@/api/ssh';
import {
  sftpListFiles,
  sftpListFilesRecursive,
  sftpUploadFileProgress,
  sftpDownloadFileProgress,
  sftpCancelTransfer,
} from '@/api/sftp';
import { save } from '@tauri-apps/plugin-dialog';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { Button } from '@/components/ui/button';
import { FileType } from '@/components/sftp/types';
import type { FileEntry, TransferItem } from '@/components/sftp/types';
import { SftpHeader } from '@/components/sftp/SftpHeader';
import { SftpToolbar } from '@/components/sftp/SftpToolbar';
import { TransferTable } from '@/components/sftp/TransferTable';
import { TransferDialog } from '@/components/sftp/TransferDialog';
import SftpPane from '@/components/sftp/SftpPane';
import ContextMenu from '@/components/sftp/ContextMenu';
import type { ConnectionConfig } from '@/components/host/dialogs/ConnectionDialog';
import { expandLocalFiles } from '@/utils/sftp';
import { useNotify } from '@/hooks/use-notify';
import { useNProgress } from '@/hooks/use-nprogress';

const TRANSFER_STORAGE_KEY = 'sftp-transfers-latest';

interface SftpProgressPayload {
  transferId: string;
  current: number;
  total: number;
  phase: string;
}

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

export default function SftpPage() {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();
  const { start, done } = useNProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const conn = (location.state as { connection?: ConnectionConfig })?.connection;

  const [tabId, setTabId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabIdRef = useRef<string | null>(null);

  const [transfers, setTransfers] = useState<TransferItem[]>(() => loadPersistedTransfers(notifyError));
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const processingRef = useRef(false);

  const activeTransferCount = transfers.filter(
    (x) => x.status === 'pending' || x.status === 'uploading' || x.status === 'downloading',
  ).length;
  const failedTransferCount = transfers.filter((x) => x.status === 'failed').length;

  useEffect(() => {
    try {
      localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify(transfers));
    } catch (e) {
      notifyError(e, false);
    }
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

  const loadDir = useCallback(
    async (dir: string) => {
      if (!tabId || loadingRef.current) return;
      loadingRef.current = true;
      start();
      setLoading(true);
      try {
        const result = await sftpListFiles({ tabId, path: dir });
        setFiles(result.files);
        setCurrentPath(result.path);
      } catch (e) {
        notifyError(e);
      } finally {
        setLoading(false);
        loadingRef.current = false;
        done();
      }
    },
    [tabId, start, done, notifyError],
  );

  useEffect(() => {
    loadDir('/');
  }, [loadDir]);

  const refresh = useCallback(() => loadDir(currentPath), [loadDir, currentPath]);

  const addRef = useRef<(paths: string[]) => Promise<void>>(async () => {});

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
        addRef.current(paths);
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
  }, [tabId, currentPath, refresh]);

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

      for (const item of newItems) {
        if (item.status !== 'pending') continue;
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
      }

      processingRef.current = false;
      loadDir(currentPath);
    },
    [tabId, currentPath, loadDir, notify, notifyError, t],
  );
  addRef.current = addTransfers;

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

        for (const item of newItems) {
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
        }
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
        if (cancelled) {
          return;
        }
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
        import('@/api/ssh').then(({ sshDisconnect }) => {
          sshDisconnect({ tabId: id }).catch((e) => notifyError(e, false));
        });
      }
    };
  }, [conn, notifyError]);

  const handleHome = () => loadDir('/');
  const handleNav = (entry: FileEntry) => {
    if (entry.file_type === FileType.Directory) loadDir(entry.path);
  };

  const handleClick = (path: string) => {
    setSelected((prev) => (prev === path ? null : path));
    setCtxMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setSelected(entry.path);
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  if (!conn) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm bg-background">
        <div className="text-center space-y-2">
          <p>No active connection</p>
          <Button variant="link" size="sm" onClick={() => navigate('/')}>
            Go to terminal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <SftpHeader conn={conn} />

      <div className="flex-1 flex gap-3 p-4 min-h-0">
        <SftpPane
          title={t('sftp.remote')}
          path={currentPath}
          entries={files}
          loading={loading}
          isActive
          selectedPath={selected}
          onActivate={() => {}}
          onHome={handleHome}
          onRefresh={refresh}
          onShowTransfers={() => setTransferDialogOpen(true)}
          activeTransferCount={activeTransferCount}
          onEntryClick={handleClick}
          onEntryDoubleClick={handleNav}
          onContextMenu={handleContextMenu}
          toolbar={
            <SftpToolbar
              tabId={tabId}
              currentPath={currentPath}
              onRefresh={refresh}
              onUpload={addTransfers}
              activeTransferCount={activeTransferCount}
              failedTransferCount={failedTransferCount}
              onShowTransfers={() => setTransferDialogOpen(true)}
            />
          }
          isDragging={isDragging}
          paneRef={panelRef}
        />
      </div>

      <TransferTable
        transfers={transfers}
        open={transfersOpen}
        onToggle={setTransfersOpen}
        onCancel={handleCancel}
        onRetry={handleRetry}
        onRemove={handleRemove}
        onClearCompleted={handleClearCompleted}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        transfers={transfers}
        onCancel={handleCancel}
        onRetry={handleRetry}
        onRemove={handleRemove}
        onClearCompleted={handleClearCompleted}
      />

      <ContextMenu
        ctxMenu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        tabId={tabId}
        onRefresh={refresh}
        onDownload={handleDownload}
        hostname={conn?.hostname}
        port={conn?.port}
        username={conn?.username}
      />
    </div>
  );
}
