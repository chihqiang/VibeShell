import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransferRow } from './TransferRow';
import type { TransferItem } from '@/types';

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
              {transfers.map((item) => (
                <TransferRow
                  key={item.id}
                  item={item}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  onRemove={onRemove}
                  iconSize={10}
                  rowHeight="h-7"
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
