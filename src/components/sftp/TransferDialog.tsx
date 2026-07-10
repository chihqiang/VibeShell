import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TransferRow } from './TransferRow';
import type { TransferItem } from '@/types';

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
            <div className="flex flex-col items-center justify-center gap-3 h-32 text-muted-foreground">
              <Inbox size={32} className="opacity-20" />
              <span className="text-xs">{t('sftp.transferIdle')}</span>
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
                {transfers.map((item) => (
                  <TransferRow
                    key={item.id}
                    item={item}
                    onCancel={onCancel}
                    onRetry={onRetry}
                    onRemove={onRemove}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
