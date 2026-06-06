import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  onValueChange: (v: string) => void;
  onConfirm: () => void;
}

export default function NewFolderDialog({ open, onOpenChange, value, onValueChange, onConfirm }: NewFolderDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('sftp.newFolder')}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          <Label>{t('sftp.name')}</Label>
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm();
            }}
            className="mt-1"
            placeholder="new-folder"
            autoFocus
          />
        </div>
        <DialogFooter>
          <DialogClose className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground cursor-pointer">
            {t('common.cancel')}
          </DialogClose>
          <Button size="sm" onClick={onConfirm}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
