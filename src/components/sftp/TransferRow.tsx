import { useTranslation } from 'react-i18next';
import {
  X,
  RotateCw,
  Square,
  Play,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  Pause,
} from 'lucide-react';
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
export function TransferRow({ item, onCancel, onRetry, onRemove, iconSize = 11, rowHeight = 'h-8' }: TransferRowProps) {
  const { t } = useTranslation();
  const pct = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
  const isActive = item.status === 'uploading' || item.status === 'downloading';

  return (
    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
      <td className={cn('px-3 truncate max-w-xs', rowHeight)} title={item.error || item.name}>
        <span className="truncate">{item.name}</span>
      </td>
      <td className="px-3">
        {item.status === 'pending' ? (
          <span className="text-muted-foreground text-xs italic">{t('sftp.transferQueued')}</span>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={cn('flex-1 rounded-full overflow-hidden', iconSize <= 10 ? 'h-1.5' : 'h-2', 'bg-secondary')}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300 relative',
                  item.status === 'completed' && 'bg-green-500',
                  item.status === 'failed' && 'bg-destructive',
                  item.status === 'cancelled' && 'bg-muted-foreground/40',
                  item.status === 'paused' && 'bg-amber-500',
                  isActive && 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              >
                {(isActive || item.status === 'paused') && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
                )}
              </div>
            </div>
            <span className="text-muted-foreground w-14 text-right tabular-nums">
              {item.total > 0 ? `${pct}%` : '--'}
            </span>
          </div>
        )}
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
            item.status === 'cancelled' && 'text-muted-foreground',
            isActive && 'text-primary',
            item.status === 'pending' && 'text-muted-foreground',
            item.status === 'paused' && 'text-amber-500',
          )}
        >
          {isActive && <LoaderCircle size={iconSize} className="animate-spin" />}
          {item.status === 'completed' && <CheckCircle2 size={iconSize} />}
          {item.status === 'failed' && <AlertCircle size={iconSize} />}
          {item.status === 'cancelled' && <X size={iconSize} />}
          {item.status === 'pending' && <LoaderCircle size={iconSize} className="opacity-50" />}
          {item.status === 'paused' && <Pause size={iconSize} />}
          {t(`sftp.transferStatus_${item.status}`)}
        </span>
        {(item.status === 'failed' || item.status === 'cancelled') && item.error && (
          <div className="text-[11px] text-destructive/70 truncate max-w-36" title={item.error}>
            {item.error}
          </div>
        )}
      </td>
      <td className="px-3 text-right">
        <div className="flex items-center justify-end gap-0.5">
          {/* 进行中 → 取消 */}
          {isActive && (
            <Button variant="ghost" size="icon-xs" onClick={() => onCancel(item.id)} title={t('sftp.transferCancel')}>
              <Square size={iconSize} />
            </Button>
          )}
          {/* 排队中 → 应允许取消 */}
          {item.status === 'pending' && (
            <Button variant="ghost" size="icon-xs" onClick={() => onCancel(item.id)} title={t('sftp.transferCancel')}>
              <X size={iconSize} />
            </Button>
          )}
          {/* 暂停 → 恢复 */}
          {item.status === 'paused' && (
            <Button variant="ghost" size="icon-xs" onClick={() => onRetry(item)} title={t('sftp.transferResume')}>
              <Play size={iconSize} />
            </Button>
          )}
          {/* 失败 → 重试 + 移除 */}
          {item.status === 'failed' && (
            <>
              <Button variant="ghost" size="icon-xs" onClick={() => onRetry(item)} title={t('sftp.transferRetry')}>
                <RotateCw size={iconSize} />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => onRemove(item.id)} title={t('common.close')}>
                <X size={iconSize} />
              </Button>
            </>
          )}
          {/* 已完成/已取消 → 移除 */}
          {(item.status === 'completed' || item.status === 'cancelled') && (
            <Button variant="ghost" size="icon-xs" onClick={() => onRemove(item.id)} title={t('common.close')}>
              <X size={iconSize} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
