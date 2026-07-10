import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './confirm-dialog';

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** i18n key for the dialog title, e.g. 'sidebar.confirmDeleteHost' */
  titleKey: string;
}

/** 删除确认对话框 — ConfirmDialog 的 destructive 特化版本 */
export function DeleteDialog({ open, onClose, onConfirm, titleKey }: DeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={t(titleKey)}
      onConfirm={onConfirm}
      variant="destructive"
      confirmLabel={t('connection.delete')}
      cancelLabel={t('connection.cancel')}
    />
  );
}
