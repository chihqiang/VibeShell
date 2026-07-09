import { useTranslation } from 'react-i18next';
import {
  X,
  RotateCw,
  Square,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TransferItem } from '@/lib/types';

interface TransferTableProps {
  transfers: TransferItem[];
  open: boolean;
  onToggle: (v: boolean) => void;
  onCancel: (id: string) => void;
  onRetry: (item: TransferItem) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function TransferTable({
  transfers,
  open,
  onToggle,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
}: TransferTableProps) {
  const { t } = useTranslation();

  const activeItems = transfers.filter(
    (t) => t.status === 'pending' || t.status === 'uploading' || t.status === 'downloading',
  );
  const failedItems = transfers.filter((t) => t.status === 'failed');
  const completedItems = transfers.filter((t) => t.status === 'completed');
  const activeCount = activeItems.length;
  const failedCount = failedItems.length;

  if (transfers.length === 0) return null;

  return (
    <div className="border-t border-border bg-secondary/10">
      <button
        onClick={() => onToggle(!open)}
        className="flex items-center gap-2 w-full h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
      >
        {activeCount > 0 ? (
          <LoaderCircle size={12} className="animate-spin text-primary" />
        ) : failedCount > 0 ? (
          <AlertCircle size={12} className="text-destructive" />
        ) : (
          <CheckCircle2 size={12} className="text-green-500" />
        )}
        <span className="font-medium">{t('sftp.transfers')}</span>
        {activeCount > 0 && (
          <span className="text-primary">
            {activeCount} {t('sftp.transferActive')}
          </span>
        )}
        {failedCount > 0 && (
          <span className="text-destructive/80">
            {failedCount} {t('sftp.transferFailed')}
          </span>
        )}
        {completedItems.length > 0 && activeCount === 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onClearCompleted();
            }}
            className="ml-1"
          >
            {t('sftp.transferClearCompleted')}
          </Button>
        )}
        <span className="ml-auto">{open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}</span>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-border">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-secondary/20">
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-3 py-1">{t('sftp.transferFile')}</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-1 w-36">
                  {t('sftp.transferProgress')}
                </th>
                <th className="text-left font-medium text-muted-foreground px-3 py-1 w-10">
                  {t('sftp.transferDirection')}
                </th>
                <th className="text-left font-medium text-muted-foreground px-3 py-1 w-20">
                  {t('sftp.transferStatus')}
                </th>
                <th className="text-right font-medium text-muted-foreground px-3 py-1 w-24">
                  {t('sftp.transferActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((item) => {
                const pct = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 h-7 truncate max-w-48" title={item.error || item.name}>
                      <span className="truncate">{item.name}</span>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              item.status === 'completed' && 'bg-green-500',
                              item.status === 'failed' && 'bg-destructive',
                              (item.status === 'uploading' || item.status === 'downloading') && 'bg-primary',
                              item.status === 'pending' && 'bg-muted-foreground/30',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-14 text-right tabular-nums">
                          {item.total > 0 ? `${pct}%` : '--'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3">
                      <span
                        className="text-muted-foreground"
                        title={item.direction === 'download' ? t('sftp.transferDownload') : t('sftp.transferUpload')}
                      >
                        {item.direction === 'download' ? <Download size={10} /> : <Upload size={10} />}
                      </span>
                    </td>
                    <td className="px-3">
                      <span
                        className={cn(
                          'flex items-center gap-1 capitalize',
                          item.status === 'completed' && 'text-green-500',
                          item.status === 'failed' && 'text-destructive',
                          (item.status === 'uploading' || item.status === 'downloading') && 'text-primary',
                          item.status === 'pending' && 'text-muted-foreground',
                        )}
                      >
                        {item.status === 'uploading' && <LoaderCircle size={10} className="animate-spin" />}
                        {item.status === 'completed' && <CheckCircle2 size={10} />}
                        {item.status === 'failed' && <AlertCircle size={10} />}
                        {item.status === 'pending' && <LoaderCircle size={10} className="opacity-50" />}
                        {t(`sftp.transferStatus_${item.status}`)}
                      </span>
                      {item.status === 'failed' && item.error && (
                        <div className="text-[11px] text-destructive/70 truncate max-w-36" title={item.error}>
                          {item.error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {(item.status === 'uploading' || item.status === 'downloading') && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onCancel(item.id)}
                            title={t('sftp.transferCancel')}
                          >
                            <Square size={10} />
                          </Button>
                        )}
                        {item.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onRetry(item)}
                            title={t('sftp.transferRetry')}
                          >
                            <RotateCw size={10} />
                          </Button>
                        )}
                        {(item.status === 'completed' || item.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onRemove(item.id)}
                            title={t('common.close')}
                          >
                            <X size={10} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
