import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './dialog';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  message?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  /** 确认按钮文案，默认取 common.confirm */
  confirmLabel?: string;
  /** 取消按钮文案，默认取 common.cancel */
  cancelLabel?: string;
}

/** 通用确认对话框 — 支持默认和危险两种样式 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
  variant = 'default',
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {message && <div className="px-5 py-4 text-sm text-muted-foreground">{message}</div>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              {cancelLabel ?? t('common.cancel')}
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant={variant}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
