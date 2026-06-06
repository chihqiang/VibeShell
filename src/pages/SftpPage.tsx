import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { sftpListFiles } from '@/apis/api/sftp';
import { FileType } from '@/apis/types/sftp';
import type { FileEntry } from '@/apis/types/sftp';
import { Button } from '@/components/ui/button';
import { SftpHeader } from '@/components/sftp/SftpHeader';
import { SftpToolbar } from '@/components/sftp/SftpToolbar';
import { TransferTable } from '@/components/sftp/TransferTable';
import { TransferDialog } from '@/components/sftp/TransferDialog';
import SftpPane from '@/components/sftp/SftpPane';
import ContextMenu from '@/components/sftp/ContextMenu';
import type { ConnectionConfig } from '@/lib/types';
import { useNotify } from '@/hooks/use-notify';
import { useNProgress } from '@/hooks/use-nprogress';
import { useSftpConnection, useSftpTransfers, useSftpDragDrop } from '@/hooks/use-tab';

export default function SftpPage() {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const { start, done } = useNProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const conn = (location.state as { connection?: ConnectionConfig })?.connection;

  const tabId = useSftpConnection(conn);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Initial load
  useEffect(() => {
    loadDir('/');
  }, [loadDir]);

  const refresh = useCallback(() => loadDir(currentPath), [loadDir, currentPath]);

  const {
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
  } = useSftpTransfers(tabId, currentPath, loadDir);

  const isDragging = useSftpDragDrop(tabId, addTransfers);

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
