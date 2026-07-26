import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, ListTodo, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TransferRow } from './TransferRow';
import type { TransferItem } from '@/types';

type FilterTab = 'all' | 'active' | 'completed' | 'failed';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transfers: TransferItem[];
  onCancel: (id: string) => void;
  onRetry: (item: TransferItem) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

const FILTERS: { key: FilterTab; label: string; icon: typeof ListTodo }[] = [
  { key: 'all', label: 'sftp.transferAll', icon: ListTodo },
  { key: 'active', label: 'sftp.transferActive_', icon: ListTodo },
  { key: 'completed', label: 'sftp.transferCompleted', icon: CheckCircle2 },
  { key: 'failed', label: 'sftp.transferFailed_', icon: AlertCircle },
];

function filterTransfers(transfers: TransferItem[], tab: FilterTab): TransferItem[] {
  switch (tab) {
    case 'all':
      return transfers;
    case 'active':
      return transfers.filter(
        (x) =>
          x.status === 'pending' || x.status === 'uploading' || x.status === 'downloading' || x.status === 'paused',
      );
    case 'completed':
      return transfers.filter((x) => x.status === 'completed');
    case 'failed':
      return transfers.filter((x) => x.status === 'failed' || x.status === 'cancelled');
  }
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
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const hasCleanable = transfers.some(
    (x) => x.status === 'completed' || x.status === 'failed' || x.status === 'cancelled',
  );

  const filtered = filterTransfers(transfers, filterTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('sftp.transfers')}
            {hasCleanable && (
              <Button variant="ghost" size="xs" onClick={onClearCompleted} className="ml-2">
                {t('sftp.transferClearCompleted')}
              </Button>
            )}
          </DialogTitle>

          {/* 分类过滤标签 */}
          {transfers.length > 0 && (
            <div className="flex gap-1 mt-2">
              {FILTERS.map(({ key, label }) => {
                const count = filterTransfers(transfers, key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterTab(key)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      filterTab === key
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {t(label)}
                    {count > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 min-w-4 h-4">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto px-1">
          {filtered.length === 0 ? (
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
                {filtered.map((item) => (
                  <TransferRow key={item.id} item={item} onCancel={onCancel} onRetry={onRetry} onRemove={onRemove} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
