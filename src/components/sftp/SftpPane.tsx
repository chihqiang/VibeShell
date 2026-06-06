import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, File, Home, Upload, LoaderCircle, RefreshCw, ListTodo } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { formatSize } from '@/lib/utils';
import { FileType } from '@/apis/types/sftp';
import type { FileEntry } from '@/apis/types/sftp';

interface SftpPaneProps {
  title: string;
  path: string;
  entries: FileEntry[];
  loading: boolean;
  isActive: boolean;
  selectedPath: string | null;
  onActivate: () => void;
  onHome: () => void;
  onRefresh: () => void;
  onShowTransfers?: () => void;
  activeTransferCount?: number;
  onEntryClick: (path: string) => void;
  onEntryDoubleClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  toolbar?: React.ReactNode;
  isDragging?: boolean;
  paneRef?: React.RefObject<HTMLDivElement | null>;
}

export default function SftpPane({
  title,
  path,
  entries,
  loading,
  isActive,
  selectedPath,
  onActivate,
  onHome,
  onRefresh,
  onShowTransfers,
  activeTransferCount = 0,
  onEntryClick,
  onEntryDoubleClick,
  onContextMenu,
  toolbar,
  isDragging,
  paneRef,
}: SftpPaneProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    getItemKey: (index) => entries[index].path,
  });

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 border rounded-xl bg-background transition-colors relative overflow-hidden ${isActive ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}
      onClick={onActivate}
      ref={paneRef}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
        <Folder size={15} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-foreground flex-shrink-0">{title}</span>
      </div>

      {toolbar}

      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload size={24} />
            <span className="text-xs font-medium">{t('sftp.dropToUpload')}</span>
          </div>
        </div>
      )}

      <div className="flex items-center px-3 h-8 border-b border-border bg-secondary/10">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Button variant="ghost" size="icon-xs" onClick={onHome}>
            <Home size={13} />
          </Button>
          <span className="text-xs text-muted-foreground truncate font-mono">{path}</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onShowTransfers} className="relative" title="Transfers">
          <ListTodo size={13} />
          {activeTransferCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-3.5 h-3.5 px-1 rounded-full text-[9px] font-bold bg-primary text-primary-foreground">
              {activeTransferCount}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onRefresh} title="Refresh">
          <RefreshCw size={13} />
        </Button>
        {loading && <LoaderCircle size={13} className="text-primary animate-spin flex-shrink-0 ml-1" />}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto text-xs">
        {entries.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground p-4">{t('sftp.empty')}</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const entry = entries[vItem.index];
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEntryClick(entry.path);
                  }}
                  onDoubleClick={() => onEntryDoubleClick(entry)}
                  onContextMenu={(e) => onContextMenu(e, entry)}
                  className={`flex items-center gap-2 px-3 h-8 cursor-pointer transition-colors absolute left-0 right-0 top-0 ${selectedPath === entry.path ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                  style={{ transform: `translateY(${vItem.start}px)` }}
                >
                  {entry.file_type === FileType.Directory ? (
                    <Folder size={15} className="text-primary flex-shrink-0" />
                  ) : (
                    <File size={15} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-foreground truncate flex-1 min-w-0">{entry.name}</span>
                  <span className="text-muted-foreground flex-shrink-0 w-28 truncate text-right tabular-nums">
                    {(entry.user || entry.uid?.toString() || '?') + '/' + (entry.group || entry.gid?.toString() || '?')}
                  </span>
                  {entry.file_type === FileType.File && (
                    <span className="text-muted-foreground flex-shrink-0 w-14 tabular-nums text-right">
                      {formatSize(entry.size)}
                    </span>
                  )}
                  {entry.file_type === FileType.Directory && <span className="w-14 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
