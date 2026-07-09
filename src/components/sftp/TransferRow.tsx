import { useTranslation } from 'react-i18next';
import { X, RotateCw, Square, LoaderCircle, CheckCircle2, AlertCircle, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import type { TransferItem } from '@/types';

interface TransferRowProps {
  item: TransferItem;
  onCancel: (id: string) => void;
  onRetry: (item: TransferItem) => void;
  onRemove: (id: string) => void;
  iconSize?: number;
  rowHeight?: string;
}

/** 传输行 — TransferTable 和 TransferDialog 的共享渲染 */
export function TransferRow({
  item,
  onCancel,
  onRetry,
  onRemove,
  iconSize = 11,
  rowHeight = 'h-8',
}: TransferRowProps) {
  const { t } = useTranslation();
  const pct = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;

  return (
    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
      <td className={cn('px-3 truncate max-w-xs', rowHeight)} title={item.error || item.name}>
        <span className="truncate">{item.name}</span>
      </td>
      <td className="px-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex-1 rounded-full overflow-hidden', iconSize <= 10 ? 'h-1.5' : 'h-2', 'bg-secondary')}>
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
          {item.direction === 'download' ? <Download size={iconSize} /> : <Upload size={iconSize} />}
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
          {item.status === 'uploading' && <LoaderCircle size={iconSize} className="animate-spin" />}
          {item.status === 'completed' && <CheckCircle2 size={iconSize} />}
          {item.status === 'failed' && <AlertCircle size={iconSize} />}
          {item.status === 'pending' && <LoaderCircle size={iconSize} className="opacity-50" />}
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
              <Square size={iconSize} />
            </Button>
          )}
          {item.status === 'failed' && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onRetry(item)}
              title={t('sftp.transferRetry')}
            >
              <RotateCw size={iconSize} />
            </Button>
          )}
          {(item.status === 'completed' || item.status === 'failed') && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onRemove(item.id)}
              title={t('common.close')}
            >
              <X size={iconSize} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
