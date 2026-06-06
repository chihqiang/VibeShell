import { useTranslation } from 'react-i18next';
import { X, RotateCw, Square, LoaderCircle, CheckCircle2, AlertCircle, Upload, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TransferItem } from '@/components/sftp/types';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transfers: TransferItem[];
  onCancel: (id: string) => void;
  onRetry: (item: TransferItem) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  transfers,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
}: TransferDialogProps) {
  const { t } = useTranslation();
  const hasCompleted = transfers.some((x) => x.status === 'completed');
  const hasFailed = transfers.some((x) => x.status === 'failed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('sftp.transfers')}
            {(hasCompleted || hasFailed) && (
              <Button variant="ghost" size="xs" onClick={onClearCompleted} className="ml-2">
                {t('sftp.transferClearCompleted')}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto px-1">
          {transfers.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
              {t('sftp.transferIdle')}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2">{t('sftp.transferFile')}</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 w-36">
                    {t('sftp.transferProgress')}
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 w-14">
                    {t('sftp.transferDirection')}
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 w-20">
                    {t('sftp.transferStatus')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2 w-24">
                    {t('sftp.transferActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((item) => {
                  const pct = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 h-8 truncate max-w-xs" title={item.error || item.name}>
                        <span className="truncate">{item.name}</span>
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
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
                          {item.direction === 'download' ? <Download size={12} /> : <Upload size={12} />}
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
                          {item.status === 'uploading' && <LoaderCircle size={11} className="animate-spin" />}
                          {item.status === 'completed' && <CheckCircle2 size={11} />}
                          {item.status === 'failed' && <AlertCircle size={11} />}
                          {item.status === 'pending' && <LoaderCircle size={11} className="opacity-50" />}
                          {t(`sftp.transferStatus_${item.status}`)}
                        </span>
                        {item.status === 'failed' && item.error && (
                          <div className="text-[10px] text-destructive/70 truncate max-w-36" title={item.error}>
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
                              <Square size={11} />
                            </Button>
                          )}
                          {item.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onRetry(item)}
                              title={t('sftp.transferRetry')}
                            >
                              <RotateCw size={11} />
                            </Button>
                          )}
                          {(item.status === 'completed' || item.status === 'failed') && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onRemove(item.id)}
                              title={t('common.close')}
                            >
                              <X size={11} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
