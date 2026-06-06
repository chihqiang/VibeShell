import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteKeyDialog({ open, onClose, onConfirm }: DeleteKeyDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="w-[360px] sm:max-w-[360px] p-0">
        <DialogHeader>
          <DialogTitle>{t('sidebar.confirmDeleteKey')}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="px-5 pb-4 pt-0">
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('connection.cancel')}
            </Button>
            <Button size="sm" variant="destructive" onClick={onConfirm}>
              {t('connection.delete')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
