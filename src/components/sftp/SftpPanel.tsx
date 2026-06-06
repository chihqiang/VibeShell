import { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useNProgress } from '@/hooks/use-nprogress';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import {
  Folder,
  File,
  Home,
  LoaderCircle,
  ArrowUp,
  RefreshCw,
  ListTodo,
  Upload,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileType } from '@/apis/types/sftp';
import { expandLocalFiles } from '@/apis/utils/sftp';
import type { FileEntry } from '@/apis/types/sftp';
import type { TransferItem } from '@/lib/types';
import { TransferDialog } from '@/components/sftp/TransferDialog';
import ContextMenu from '@/components/sftp/ContextMenu';
import NewFileDialog from '@/components/sftp/dialogs/NewFileDialog';
import NewFolderDialog from '@/components/sftp/dialogs/NewFolderDialog';
import { formatSize } from '@/lib/utils';
import { useNotify } from '@/hooks/use-notify';
import {
  sftpListFiles,
  sftpListFilesRecursive,
  sftpCreateDir,
  sftpCreateFile,
  sftpUploadFileProgress,
  sftpDownloadFileProgress,
  sftpCancelTransfer,
} from '@/apis/api/sftp';

export default function SftpPanel() {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();
  const { start, done } = useNProgress();
  const { activeTabId, tabs } = useTerminalTabs();
  const tabId = activeTabId;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const conn = activeTab?.type === 'terminal' ? activeTab.connectConfig : undefined;
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirValue, setMkdirValue] = useState('');
  const [mkfileOpen, setMkfileOpen] = useState(false);
  const [mkfileValue, setMkfileValue] = useState('');

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const processingRef = useRef(false);
  const activeTransferCount = transfers.filter(
    (x) => x.status === 'pending' || x.status === 'uploading' || x.status === 'downloading',
  ).length;

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    getItemKey: (index) => entries[index].path,
  });

  const loadDir = useCallback(
    async (dir: string) => {
      if (!tabId || loadingRef.current) return;
      loadingRef.current = true;
      start();
      setLoading(true);
      try {
        const result = await sftpListFiles({ tabId, path: dir });
        setEntries(result.files);
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
    loadDir('.');
  }, [loadDir]);

  const uploadRef = useRef<
    (files: { localPath: string; remotePath: string; name: string }[], onComplete: () => void) => Promise<void>
  >(async () => {});

  useEffect(() => {
    if (!tabId) return;
    const wv = getCurrentWebview();
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    wv.onDragDropEvent(async (event) => {
      try {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'leave') {
          setIsDragging(false);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          const paths = event.payload.paths;
          if (paths.length === 0) return;

          const { files: allFiles } = await expandLocalFiles(paths, currentPath);

          uploadRef.current(allFiles, () => loadDir(currentPath));
        }
      } catch (e) {
        notifyError(e);
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
  }, [tabId, currentPath, loadDir, notifyError]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;
    listen<{
      transferId: string;
      current: number;
      total: number;
      phase: string;
    }>('sftp://transfer-progress', (event) => {
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

  const navigateUp = () => {
    if (currentPath === '.' || currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  };

  const handleDoubleClick = (entry: FileEntry) => {
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
        setTransferDialogOpen(true);

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
      setTransferDialogOpen(true);
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

  const uploadFilesWithProgress = useCallback(
    async (allFiles: { localPath: string; remotePath: string; name: string }[], onComplete: () => void) => {
      if (!tabId) return;
      if (processingRef.current) return;
      processingRef.current = true;

      const newItems: TransferItem[] = allFiles.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        localPath: f.localPath,
        remotePath: f.remotePath,
        current: 0,
        total: 0,
        status: 'pending' as const,
        direction: 'upload' as const,
      }));

      if (newItems.length === 0) {
        processingRef.current = false;
        return;
      }

      setTransfers((prev) => [...newItems, ...prev]);
      setTransferDialogOpen(true);

      const failures: string[] = [];
      for (const item of newItems) {
        setTransfers((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading' } : x)));
        try {
          await sftpUploadFileProgress({
            tabId: tabId!,
            localPath: item.localPath,
            remotePath: item.remotePath,
            transferId: item.id,
          });
          setTransfers((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, status: 'completed', current: x.total || 1 } : x)),
          );
        } catch (e) {
          notifyError(e);
          failures.push(`${item.name}: ${String(e)}`);
          setTransfers((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: String(e) } : x)),
          );
        }
      }

      if (failures.length > 0) {
        notify(`${t('sftp.uploadFailed')}: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '...' : ''}`);
      }
      processingRef.current = false;
      onComplete();
    },
    [tabId, t, notify, notifyError, setTransfers, setTransferDialogOpen],
  );
  uploadRef.current = uploadFilesWithProgress;

  const doUpload = async () => {
    if (!tabId) return;
    const src = await open({ multiple: true });
    if (!src) return;
    const paths = Array.isArray(src) ? src : [src];
    if (paths.length === 0) return;

    const { files: allFiles, failures } = await expandLocalFiles(paths, currentPath);

    if (failures.length > 0) {
      for (const f of failures) {
        notifyError(t(f.error) || f.error);
      }
    }

    uploadFilesWithProgress(allFiles, () => loadDir(currentPath));
  };

  const doUploadFolder = async () => {
    if (!tabId) return;
    const folder = await open({ directory: true });
    if (!folder) return;

    const { files: allFiles, failures } = await expandLocalFiles([folder], currentPath, { fallbackName: 'folder' });

    if (failures.length > 0) {
      for (const f of failures) {
        notifyError(t(f.error) || f.error, false);
      }
    }

    uploadFilesWithProgress(allFiles, () => loadDir(currentPath));
  };

  const doNewFile = async () => {
    if (!tabId || !mkfileValue.trim()) return;
    const rp = currentPath.replace(/\/?$/, '/') + mkfileValue.trim();
    try {
      await sftpCreateFile({ tabId, path: rp });
      notify(t('sftp.newFileSuccess'));
      setMkfileOpen(false);
      setMkfileValue('');
      loadDir(currentPath);
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
      setMkfileOpen(false);
      setMkdirValue('');
      loadDir(currentPath);
    } catch (e) {
      notifyError(`${t('sftp.newFolderFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div ref={panelRef} className="h-full flex flex-col relative overflow-hidden">
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload size={32} />
            <span className="text-sm font-medium">{t('sftp.dropToUpload')}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-3 py-1 bg-secondary/20 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={() => loadDir('.')}>
          <Home size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={navigateUp}
          disabled={currentPath === '.' || currentPath === '/'}
        >
          <ArrowUp size={12} />
        </Button>
        <input
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') loadDir(currentPath || '.');
          }}
          className="flex-1 ml-1 h-5 px-1 text-[11px] font-mono bg-transparent border-none outline-none text-muted-foreground focus:text-foreground"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setTransferDialogOpen(true)}
          className="relative"
          title="Transfers"
        >
          <ListTodo size={12} />
          {activeTransferCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-3 h-3 px-1 rounded-full text-[8px] font-bold bg-primary text-primary-foreground">
              {activeTransferCount}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => loadDir(currentPath)} title={t('sftp.refresh')}>
          <RefreshCw size={12} />
        </Button>
        {loading && <LoaderCircle size={12} className="text-primary animate-spin flex-shrink-0 ml-1" />}
      </div>

      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-secondary/10 flex-shrink-0">
        <Button variant="ghost" size="xs" onClick={doUpload}>
          <Upload size={13} /> {t('sftp.upload')}
        </Button>
        <Button variant="ghost" size="xs" onClick={doUploadFolder}>
          <FolderPlus size={13} /> {t('sftp.uploadFolder')}
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
      </div>

      <div className="flex-1 flex flex-col min-h-0 text-[11px]">
        <div className="grid grid-cols-[1fr_70px_90px_100px_140px] bg-secondary/10 border-b border-border flex-shrink-0">
          <div className="text-left font-medium text-muted-foreground px-3 py-1 text-[10px]">{t('sftp.name')}</div>
          <div className="text-right font-medium text-muted-foreground px-3 py-1 text-[10px]">{t('sftp.size')}</div>
          <div className="text-left font-medium text-muted-foreground px-3 py-1 text-[10px]">
            {t('sftp.permissions')}
          </div>
          <div className="text-left font-medium text-muted-foreground px-3 py-1 text-[10px]">
            {t('sftp.user')}/{t('sftp.group')}
          </div>
          <div className="text-left font-medium text-muted-foreground px-3 py-1 text-[10px]">{t('sftp.modified')}</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {entries.length === 0 && !loading ? (
            <div className="text-center text-muted-foreground py-12">{t('sftp.empty')}</div>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const entry = entries[vItem.index];
                return (
                  <div
                    key={vItem.key}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    onClick={() => handleClick(entry.path)}
                    onDoubleClick={() => handleDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    className={`grid grid-cols-[1fr_70px_90px_100px_140px] cursor-pointer transition-colors absolute left-0 right-0 top-0 h-7 ${selected === entry.path ? 'bg-primary/10' : 'hover:bg-muted'}`}
                    style={{ transform: `translateY(${vItem.start}px)` }}
                  >
                    <div className="px-3 flex items-center gap-1.5 truncate">
                      {entry.file_type === FileType.Directory ? (
                        <Folder size={14} className="text-primary flex-shrink-0" />
                      ) : (
                        <File size={14} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-foreground truncate">{entry.name}</span>
                    </div>
                    <div className="text-muted-foreground text-right tabular-nums px-3 self-center">
                      {entry.file_type === FileType.Directory ? '—' : formatSize(entry.size)}
                    </div>
                    <div className="text-muted-foreground font-mono px-3 whitespace-nowrap self-center">
                      {entry.mode}
                    </div>
                    <div className="text-muted-foreground px-3 whitespace-nowrap tabular-nums self-center">
                      {(entry.user || entry.uid?.toString() || '?') +
                        '/' +
                        (entry.group || entry.gid?.toString() || '?')}
                    </div>
                    <div className="text-muted-foreground px-3 whitespace-nowrap self-center">{entry.modified}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ContextMenu
        ctxMenu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        tabId={tabId}
        onRefresh={() => loadDir(currentPath)}
        onDownload={handleDownload}
        hostname={conn?.hostname}
        port={conn?.port}
        username={conn?.username}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        transfers={transfers}
        onCancel={(id) => {
          sftpCancelTransfer({ transferId: id }).catch((e) => notifyError(e));
          setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'failed', error: 'Cancelled' } : x)));
        }}
        onRetry={(item) => {
          setTransfers((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading', current: 0, error: undefined } : x)),
          );
          (async () => {
            try {
              if (item.direction === 'download') {
                await sftpDownloadFileProgress({
                  tabId: tabId!,
                  remotePath: item.remotePath,
                  localPath: item.localPath,
                  transferId: item.id,
                });
              } else {
                await sftpUploadFileProgress({
                  tabId: tabId!,
                  localPath: item.localPath,
                  remotePath: item.remotePath,
                  transferId: item.id,
                });
              }
              setTransfers((prev) =>
                prev.map((x) => (x.id === item.id ? { ...x, status: 'completed', current: x.total || 1 } : x)),
              );
            } catch (e) {
              notifyError(e);
              setTransfers((prev) =>
                prev.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: String(e) } : x)),
              );
            }
          })();
        }}
        onRemove={(id) => setTransfers((prev) => prev.filter((x) => x.id !== id))}
        onClearCompleted={() =>
          setTransfers((prev) => prev.filter((x) => x.status !== 'completed' && x.status !== 'failed'))
        }
      />

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
    </div>
  );
}
